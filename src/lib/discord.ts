/**
 * Discord Webhook Client
 * Send notifications to Discord via webhooks
 */

/**
 * Send a basic message to a Discord webhook
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  content: string
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
      }),
    });

    if (!response.ok) {
      console.error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Discord message:', error);
    return false;
  }
}

/**
 * Send a formatted test recap embed
 */
export async function sendTestRecap(
  webhookUrl: string,
  testName: string,
  status: 'pass' | 'fail' | 'skip',
  duration: number
): Promise<boolean> {
  const statusColors = {
    pass: 0x22c55e,
    fail: 0xef4444,
    skip: 0xeab308,
  };

  const statusEmojis = {
    pass: '✅',
    fail: '❌',
    skip: '⏭️',
  };

  const statusText = {
    pass: 'Passed',
    fail: 'Failed',
    skip: 'Skipped',
  };

  try {
    const embed = {
      title: `${statusEmojis[status]} Test Recap`,
      color: statusColors[status],
      fields: [
        {
          name: 'Test',
          value: testName,
          inline: true,
        },
        {
          name: 'Status',
          value: statusText[status],
          inline: true,
        },
        {
          name: 'Duration',
          value: `${duration}ms`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Test Runner',
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      console.error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send test recap:', error);
    return false;
  }
}

/**
 * Send a formatted CLI recap embed
 */
export async function sendCLIRecap(
  webhookUrl: string,
  command: string,
  output: string
): Promise<boolean> {
  const maxOutputLength = 1000;
  const truncatedOutput = output.length > maxOutputLength
    ? output.substring(0, maxOutputLength) + '\n... (truncated)'
    : output;

  try {
    const embed = {
      title: '🔧 CLI Recap',
      color: 0x6366f1,
      fields: [
        {
          name: 'Command',
          value: `\`${command}\``,
        },
        {
          name: 'Output',
          value: `\`\`\`\n${truncatedOutput}\n\`\`\``,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'CLI Runner',
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      console.error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send CLI recap:', error);
    return false;
  }
}
