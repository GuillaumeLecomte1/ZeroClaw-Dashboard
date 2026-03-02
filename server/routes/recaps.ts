import { Router, Request, Response } from 'express';
import { sendTestRecap, sendCLIRecap } from '../../src/lib/discord.js';
import { generateRecapEmailHTML } from './email.js';
import nodemailer from 'nodemailer';

type RecapType = 'manual' | 'playwright' | 'cli' | 'scheduled';
type RecapStatus = 'pending' | 'sent' | 'failed';
type TriggerType = 'playwright_test' | 'cli_command' | 'manual' | 'scheduled';
type ScheduleFrequency = 'daily' | 'weekly';
type NotificationChannel = 'discord' | 'email' | 'both';

interface RecapSchedule {
  id: string;
  name: string;
  frequency: ScheduleFrequency;
  time: string;
  dayOfWeek?: number;
  channels: NotificationChannel;
  triggers: TriggerType[];
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
}

interface RecapHistoryEntry {
  id: string;
  type: RecapType;
  status: RecapStatus;
  trigger: TriggerType;
  channels: NotificationChannel;
  title: string;
  summary: string;
  items: RecapItem[];
  timestamp: string;
  error?: string;
}

interface RecapItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface TriggerPayload {
  type: TriggerType;
  title?: string;
  summary?: string;
  items?: RecapItem[];
  testName?: string;
  testStatus?: 'pass' | 'fail' | 'skip';
  testDuration?: number;
  command?: string;
  output?: string;
  channels?: NotificationChannel;
  discordWebhook?: string;
  emailTo?: string;
}

const PRESET_TIMES = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'] as const;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function createRecapsRouter(): Router {
  const router = Router();

  const schedules: Map<string, RecapSchedule> = new Map();
  const history: RecapHistoryEntry[] = [];
  let scheduleIdCounter = 1;
  let historyIdCounter = 1;
  let schedulerInterval: NodeJS.Timeout | null = null;

  function generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++historyIdCounter}`;
  }

  function getSMTPConfig() {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };
  }

  function createTransporter() {
    const config = getSMTPConfig();
    if (!config.host || !config.auth.user || !config.auth.pass) {
      throw new Error('SMTP configuration is incomplete');
    }
    return nodemailer.createTransport(config);
  }

  async function sendRecapToDiscord(
    webhookUrl: string,
    payload: TriggerPayload
  ): Promise<boolean> {
    if (payload.type === 'playwright_test' && payload.testName) {
      return sendTestRecap(
        webhookUrl,
        payload.testName,
        payload.testStatus || 'skip',
        payload.testDuration || 0
      );
    }

    if (payload.type === 'cli_command' && payload.command) {
      return sendCLIRecap(webhookUrl, payload.command, payload.output || '');
    }

    const items = payload.items || [];
    const embed = {
      title: payload.title || 'Recap Notification',
      color: payload.items?.some(i => i.type === 'error') ? 0xef4444 :
             payload.items?.some(i => i.type === 'warning') ? 0xf59e0b :
             payload.items?.some(i => i.type === 'success') ? 0x22c55e : 0x3b82f6,
      description: payload.summary || '',
      fields: items.slice(0, 10).map(item => ({
        name: `${item.type === 'error' ? '❌' : item.type === 'warning' ? '⚠️' : item.type === 'success' ? '✅' : 'ℹ️'} ${item.message}`,
        value: item.details || '',
        inline: false,
      })),
      timestamp: new Date().toISOString(),
      footer: {
        text: `Trigger: ${payload.type}`,
      },
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to send Discord recap:', error);
      return false;
    }
  }

  async function sendRecapToEmail(
    to: string,
    payload: TriggerPayload
  ): Promise<boolean> {
    try {
      const html = generateRecapEmailHTML(
        payload.title || 'Recap Notification',
        payload.summary || '',
        payload.items || [],
        new Date().toISOString()
      );

      const transporter = createTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: payload.title || 'Recap Notification',
        html,
      });
      return true;
    } catch (error) {
      console.error('Failed to send email recap:', error);
      return false;
    }
  }

  async function processRecap(payload: TriggerPayload, channels: NotificationChannel): Promise<RecapHistoryEntry> {
    const entry: RecapHistoryEntry = {
      id: generateId('recap'),
      type: payload.type === 'playwright_test' ? 'playwright' :
            payload.type === 'cli_command' ? 'cli' :
            payload.type === 'scheduled' ? 'scheduled' : 'manual',
      status: 'pending',
      trigger: payload.type,
      channels,
      title: payload.title || 'Recap Notification',
      summary: payload.summary || '',
      items: payload.items || [],
      timestamp: new Date().toISOString(),
    };

    let success = true;
    let error: string | undefined;

    if (channels === 'discord' || channels === 'both') {
      const webhookUrl = payload.discordWebhook || process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        const discordSuccess = await sendRecapToDiscord(webhookUrl, payload);
        if (!discordSuccess) {
          success = false;
          error = 'Failed to send Discord notification';
        }
      } else {
        success = false;
        error = 'No Discord webhook configured';
      }
    }

    if (channels === 'email' || channels === 'both') {
      const emailTo = payload.emailTo || process.env.RECAP_EMAIL_TO;
      if (emailTo) {
        const emailSuccess = await sendRecapToEmail(emailTo, payload);
        if (!emailSuccess) {
          success = false;
          error = error ? `${error}; Failed to send email` : 'Failed to send email';
        }
      } else {
        success = false;
        error = error ? `${error}; No email recipient configured` : 'No email recipient configured';
      }
    }

    entry.status = success ? 'sent' : 'failed';
    entry.error = error;

    history.unshift(entry);
    if (history.length > 100) {
      history.pop();
    }

    return entry;
  }

  function getNextRunTime(schedule: RecapSchedule): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    if (schedule.frequency === 'daily') {
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== undefined) {
      const currentDay = now.getDay();
      let daysUntilNext = schedule.dayOfWeek - currentDay;
      
      if (daysUntilNext < 0 || (daysUntilNext === 0 && nextRun <= now)) {
        daysUntilNext += 7;
      }
      
      nextRun.setDate(nextRun.getDate() + daysUntilNext);
    }

    return nextRun;
  }

  function startScheduler() {
    if (schedulerInterval) return;
    
    schedulerInterval = setInterval(async () => {
      const now = new Date();
      
      for (const [, schedule] of schedules) {
        if (!schedule.enabled) continue;
        
        const nextRun = getNextRunTime(schedule);
        const timeDiff = nextRun.getTime() - now.getTime();
        
        if (timeDiff >= 0 && timeDiff <= 60000) {
          console.log(`Executing scheduled recap: ${schedule.name}`);
          
          await processRecap(
            {
              type: 'scheduled',
              title: `Scheduled Recap: ${schedule.name}`,
              summary: `${schedule.frequency} recap`,
              channels: schedule.channels,
            },
            schedule.channels
          );
          
          schedule.lastRun = now.toISOString();
        }
      }
    }, 60000);
    
    console.log('Recap scheduler started');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function stopScheduler() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
      console.log('Recap scheduler stopped');
    }
  }

  startScheduler();

  router.post('/trigger', async (req: Request, res: Response) => {
    try {
      const payload = req.body as TriggerPayload;

      if (!payload.type) {
        res.status(400).json({ error: 'Trigger type is required' });
        return;
      }

      const validTypes: TriggerType[] = ['playwright_test', 'cli_command', 'manual', 'scheduled'];
      if (!validTypes.includes(payload.type)) {
        res.status(400).json({ 
          error: `Invalid trigger type. Allowed: ${validTypes.join(', ')}` 
        });
        return;
      }

      const channels = payload.channels || 'discord';
      const validChannels: NotificationChannel[] = ['discord', 'email', 'both'];
      if (!validChannels.includes(channels)) {
        res.status(400).json({ 
          error: `Invalid channel. Allowed: ${validChannels.join(', ')}` 
        });
        return;
      }

      const entry = await processRecap(payload, channels);
      
      res.json({
        success: entry.status === 'sent',
        recap: entry,
      });
    } catch (error) {
      const err = error as Error;
      console.error('Recap trigger error:', err.message);
      res.status(500).json({ error: 'Failed to process recap', details: err.message });
    }
  });

  router.get('/history', (_req: Request, res: Response) => {
    const limit = Math.min(parseInt(_req.query.limit as string) || 20, 100);
    const offset = parseInt(_req.query.offset as string) || 0;
    
    const paginatedHistory = history.slice(offset, offset + limit);
    
    res.json({
      total: history.length,
      limit,
      offset,
      history: paginatedHistory,
    });
  });

  router.get('/history/:id', (req: Request, res: Response) => {
    const entry = history.find(h => h.id === req.params.id);
    
    if (!entry) {
      res.status(404).json({ error: 'Recap entry not found' });
      return;
    }
    
    res.json(entry);
  });

  router.post('/schedule', (req: Request, res: Response) => {
    try {
      const { name, frequency, time, dayOfWeek, channels, triggers, enabled } = req.body as {
        name: string;
        frequency: ScheduleFrequency;
        time: string;
        dayOfWeek?: number;
        channels: NotificationChannel;
        triggers?: TriggerType[];
        enabled?: boolean;
      };

      if (!name || !frequency || !time || !channels) {
        res.status(400).json({ 
          error: 'Missing required fields: name, frequency, time, channels' 
        });
        return;
      }

      const validFrequencies: ScheduleFrequency[] = ['daily', 'weekly'];
      if (!validFrequencies.includes(frequency)) {
        res.status(400).json({ 
          error: `Invalid frequency. Allowed: ${validFrequencies.join(', ')}` 
        });
        return;
      }

      if (!PRESET_TIMES.includes(time as typeof PRESET_TIMES[number])) {
        res.status(400).json({ 
          error: `Invalid time. Allowed presets: ${PRESET_TIMES.join(', ')}` 
        });
        return;
      }

      if (frequency === 'weekly') {
        if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
          res.status(400).json({ 
            error: 'dayOfWeek is required for weekly schedules (0-6, Sunday=0)' 
          });
          return;
        }
      }

      const validChannels: NotificationChannel[] = ['discord', 'email', 'both'];
      if (!validChannels.includes(channels)) {
        res.status(400).json({ 
          error: `Invalid channels. Allowed: ${validChannels.join(', ')}` 
        });
        return;
      }

      const validTriggers: TriggerType[] = ['playwright_test', 'cli_command', 'manual', 'scheduled'];
      const triggerList = triggers && triggers.length > 0 
        ? triggers.filter(t => validTriggers.includes(t))
        : ['scheduled'];

      const id = `schedule_${++scheduleIdCounter}`;
      const schedule: RecapSchedule = {
        id,
        name,
        frequency,
        time,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
        channels,
        triggers: triggerList,
        enabled: enabled !== false,
        createdAt: new Date().toISOString(),
      };

      schedules.set(id, schedule);

      res.status(201).json({
        success: true,
        schedule,
        nextRun: getNextRunTime(schedule).toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      console.error('Schedule creation error:', err.message);
      res.status(500).json({ error: 'Failed to create schedule', details: err.message });
    }
  });

  router.get('/schedule', (_req: Request, res: Response) => {
    const scheduleList = Array.from(schedules.values()).map(schedule => ({
      ...schedule,
      nextRun: getNextRunTime(schedule).toISOString(),
    }));
    
    res.json({
      total: scheduleList.length,
      schedules: scheduleList,
      presetTimes: PRESET_TIMES,
      weekdays: WEEKDAYS,
    });
  });

  router.get('/schedule/:id', (req: Request, res: Response) => {
    const schedule = schedules.get(req.params.id);
    
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    
    res.json({
      ...schedule,
      nextRun: getNextRunTime(schedule).toISOString(),
    });
  });

  router.put('/schedule/:id', (req: Request, res: Response) => {
    const schedule = schedules.get(req.params.id);
    
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const updates = req.body;
    
    if (updates.time && !PRESET_TIMES.includes(updates.time as typeof PRESET_TIMES[number])) {
      res.status(400).json({ 
        error: `Invalid time. Allowed presets: ${PRESET_TIMES.join(', ')}` 
      });
      return;
    }

    if (updates.frequency) {
      const validFrequencies: ScheduleFrequency[] = ['daily', 'weekly'];
      if (!validFrequencies.includes(updates.frequency)) {
        res.status(400).json({ 
          error: `Invalid frequency. Allowed: ${validFrequencies.join(', ')}` 
        });
        return;
      }
    }

    const updatedSchedule = {
      ...schedule,
      ...updates,
      id: schedule.id,
      createdAt: schedule.createdAt,
    };

    schedules.set(req.params.id, updatedSchedule);

    res.json({
      success: true,
      schedule: updatedSchedule,
      nextRun: getNextRunTime(updatedSchedule).toISOString(),
    });
  });

  router.delete('/schedule/:id', (req: Request, res: Response) => {
    const schedule = schedules.get(req.params.id);
    
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    schedules.delete(req.params.id);
    
    res.json({ 
      success: true, 
      message: `Schedule '${schedule.name}' deleted` 
    });
  });

  router.post('/schedule/:id/toggle', (req: Request, res: Response) => {
    const schedule = schedules.get(req.params.id);
    
    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    schedule.enabled = !schedule.enabled;
    schedules.set(req.params.id, schedule);

    res.json({
      success: true,
      schedule: {
        ...schedule,
        nextRun: getNextRunTime(schedule).toISOString(),
      },
    });
  });

  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      presetTimes: PRESET_TIMES,
      weekdays: WEEKDAYS.map((day, index) => ({ index, name: day })),
      channels: ['discord', 'email', 'both'],
      frequencies: ['daily', 'weekly'],
      triggers: ['playwright_test', 'cli_command', 'manual', 'scheduled'],
    });
  });

  return router;
}

export function stopRecapScheduler() {
  stopScheduler();
}
