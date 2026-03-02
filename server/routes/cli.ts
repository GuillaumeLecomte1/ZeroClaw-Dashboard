import { Router, Request, Response } from 'express';

// Whitelist of allowed CLI commands
// Only commands in this list can be executed via the CLI endpoint
const ALLOWED_COMMANDS = new Set([
  'git',
  'npm',
  'npx',
  'bun',
  'node',
  'pnpm',
  'yarn',
  'docker',
  'docker-compose',
  'curl',
  'ls',
  'cat',
  'echo',
  'pwd',
  'mkdir',
  'rm',
  'cp',
  'mv',
  'cd',
  'grep',
  'find',
  'chmod',
  'touch',
]);

// Allowed subcommands for each base command
const ALLOWED_SUBCOMMANDS: Record<string, Set<string>> = {
  git: new Set([
    'status', 'log', 'diff', 'branch', 'checkout', 'commit', 'push', 'pull',
    'fetch', 'clone', 'init', 'add', 'reset', 'rebase', 'merge', 'stash',
    'show', 'remote', 'tag', 'describe', 'rev-parse', 'ls-files'
  ]),
  npm: new Set([
    'install', 'run', 'test', 'build', 'start', 'dev', 'init', 'publish',
    'uninstall', 'update', 'audit', 'outdated', 'ls', 'view', 'info'
  ]),
  npx: new Set([
    'create', 'tsc', 'vite', 'webpack', 'eslint', 'prettier'
  ]),
  bun: new Set([
    'install', 'run', 'test', 'build', 'add', 'remove', 'pm'
  ]),
  pnpm: new Set([
    'install', 'run', 'test', 'build', 'add', 'remove', 'init'
  ]),
  yarn: new Set([
    'install', 'run', 'test', 'build', 'add', 'remove', 'init'
  ]),
  docker: new Set([
    'ps', 'images', 'build', 'run', 'stop', 'start', 'rm', 'rmi', 'logs',
    'exec', 'pull', 'push', 'compose', 'network', 'volume'
  ]),
  'docker-compose': new Set([
    'up', 'down', 'start', 'stop', 'ps', 'logs', 'build'
  ]),
};

interface CLIRequestBody {
  command: string;
  args?: string[];
  cwd?: string;
}

function validateCommand(command: string): { valid: boolean; error?: string } {
  const parts = command.trim().split(/\s+/);
  const baseCommand = parts[0];

  if (!ALLOWED_COMMANDS.has(baseCommand)) {
    return {
      valid: false,
      error: `Command '${baseCommand}' is not allowed. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`
    };
  }

  // Check subcommands if applicable
  if (parts.length > 1 && ALLOWED_SUBCOMMANDS[baseCommand]) {
    const subcommand = parts[1];
    if (!ALLOWED_SUBCOMMANDS[baseCommand].has(subcommand)) {
      return {
        valid: false,
        error: `Subcommand '${subcommand}' is not allowed for '${baseCommand}'. Allowed: ${Array.from(ALLOWED_SUBCOMMANDS[baseCommand] || []).join(', ')}`
      };
    }
  }

  return { valid: true };
}

export function createCLIRouter(): Router {
  const router = Router();

  // POST /api/cli/execute - Execute a CLI command
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { command, args = [], cwd } = req.body as CLIRequestBody;

      if (!command) {
        res.status(400).json({ error: 'Command is required' });
        return;
      }

      // Validate command against whitelist
      const validation = validateCommand(command);
      if (!validation.valid) {
        res.status(403).json({ error: validation.error });
        return;
      }

      // Build the full command
      const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

      // Execute the command
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const options: { cwd?: string; timeout?: number } = {
        timeout: 30000, // 30 second timeout
      };
      
      if (cwd) {
        options.cwd = cwd;
      }

      const { stdout, stderr } = await execAsync(fullCommand, options);

      res.json({
        success: true,
        command: fullCommand,
        stdout: stdout || '(no output)',
        stderr: stderr || '(no errors)',
        exitCode: 0,
      });
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number; message?: string };
      res.json({
        success: false,
        command: req.body.command,
        stdout: err.stdout || '',
        stderr: err.stderr || err.message || 'Command execution failed',
        exitCode: err.code || 1,
      });
    }
  });

  // GET /api/cli/allowed - Get list of allowed commands
  router.get('/allowed', (_req: Request, res: Response) => {
    res.json({
      commands: Array.from(ALLOWED_COMMANDS),
      subcommands: Object.fromEntries(
        Object.entries(ALLOWED_SUBCOMMANDS).map(([cmd, subs]) => [cmd, Array.from(subs)])
      ),
    });
  });

  return router;
}
