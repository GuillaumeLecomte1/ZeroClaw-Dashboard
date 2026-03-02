import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createCLIRouter } from './routes/cli.js';
import { createEmailRouter } from './routes/email.js';
import { createRecapsRouter } from './routes/recaps.js';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

const app = express();
const PORT = process.env.PORT || 3001;
const ZEROCLAW_API_URL = process.env.ZEROCLAW_API_URL || 'http://localhost:3033';

const ZEROCLAW_TOKEN = process.env.ZEROCLAW_TOKEN;
if (!ZEROCLAW_TOKEN) {
  console.error('Error: ZEROCLAW_TOKEN is not set in server/.env');
  process.exit(1);
}

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

async function proxyRequest(
  req: Request,
  res: Response,
  endpoint: string,
  targetUrl: string
) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${targetUrl}${endpoint}`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZEROCLAW_TOKEN}`,
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      res.status(504).json({ error: 'Gateway timeout' });
      return;
    }
    res.status(502).json({ error: 'Bad gateway' });
  }
}

app.post('/api/chat', (req: Request, res: Response) => {
  proxyRequest(req, res, '/v1/responses', ZEROCLAW_API_URL);
});

app.post('/api/tools/invoke', (req: Request, res: Response) => {
  proxyRequest(req, res, '/tools/invoke', ZEROCLAW_API_URL);
});

app.use('/api/cli', createCLIRouter());
app.use('/api/email', createEmailRouter());
app.use('/api/recaps', createRecapsRouter());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: unknown): void => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Proxying requests to ${ZEROCLAW_API_URL}`);
});
