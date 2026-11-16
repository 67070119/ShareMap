#!/usr/bin/env node
/**
 * One-time first ADMIN bootstrap — operator-triggered only.
 *
 * Invoke from an interactive terminal: npm run admin:bootstrap
 * Do not accept password arguments, stdin pipes, env passwords or an HTTP call.
 * No migrations/seed run automatically. Existing ADMINs are adopted safely.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  AdminBootstrapError,
  bootstrapFirstAdmin,
  inspectInitialAdminStatus,
  validateBootstrapCredentials,
} from '../src/services/admin-bootstrap.service.js';

function interactiveLine(label, { hidden = false, limit = 512 } = {}) {
  const stdin = process.stdin;
  const stdout = process.stdout;
  return new Promise((resolve, reject) => {
    let data = '';
    let settled = false;
    const wasRaw = Boolean(stdin.isRaw);

    function finish(error = null) {
      if (settled) return;
      settled = true;
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(data);
    }

    function onEnd() {
      finish(new AdminBootstrapError('CANCELLED', 'Terminal input closed.'));
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish();
          return;
        }
        if (char === '\u0003' || char === '\u0004') {
          finish(new AdminBootstrapError('CANCELLED', 'Bootstrap cancelled.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (data.length) {
            data = Array.from(data).slice(0, -1).join('');
            if (!hidden) stdout.write('\b \b');
          }
          continue;
        }
        if (char === '\u0015') {
          if (!hidden) stdout.write('\b \b'.repeat(Array.from(data).length));
          data = '';
          continue;
        }
        if (char === '\u001b') continue; // Ignore terminal escape leader.
        if (char < ' ' || char === '\u007f') continue;
        data += char;
        if (Buffer.byteLength(data, 'utf8') > limit) {
          finish(new AdminBootstrapError('INPUT_TOO_LONG', 'Input exceeds the allowed length.'));
          return;
        }
        if (!hidden) stdout.write(char);
      }
    }

    stdout.write(label);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true); // Disables OS terminal echo, including for passwords.
    stdin.on('data', onData);
    stdin.once('end', onEnd);
    stdin.resume();
  });
}

function printAvailability(status) {
  if (status.kind === 'already_completed') {
    console.error('ADMIN_BOOTSTRAP_ALREADY_COMPLETED: Create further Admins via Dashboard.');
    process.exitCode = 1;
    return false;
  }
  if (status.kind === 'legacy_adopted') {
    console.error('LEGACY_ADMIN_ADOPTED: An Admin already existed. CLI is now permanently locked.');
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function main() {
  if (process.argv.length > 2) {
    throw new AdminBootstrapError('CLI_ARGUMENTS_DISABLED',
      'This command accepts no arguments. Enter credentials interactively.');
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY ||
      typeof process.stdin.setRawMode !== 'function') {
    throw new AdminBootstrapError('INTERACTIVE_TERMINAL_REQUIRED',
      'Use an interactive TTY; piped or redirected credentials are not accepted.');
  }
  if (!process.env.DATABASE_URL) {
    throw new AdminBootstrapError('DATABASE_URL_REQUIRED',
      'Configure DATABASE_URL for the intended database.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const firstCheck = await inspectInitialAdminStatus(prisma);
    if (!printAvailability(firstCheck)) return;

    console.log('Initial ADMIN setup (one-time). Credentials are never echoed to logs.');
    const name = await interactiveLine('Name: ', { limit: 320 });
    const email = await interactiveLine('Email: ', { limit: 254 });
    const password = await interactiveLine('Password (hidden): ', { hidden: true, limit: 72 });
    const confirmation = await interactiveLine('Confirm password (hidden): ', { hidden: true, limit: 72 });
    if (password !== confirmation) {
      throw new AdminBootstrapError('PASSWORD_MISMATCH', 'Passwords do not match.');
    }
    validateBootstrapCredentials({ name, email, password });

    const result = await bootstrapFirstAdmin(prisma, { name, email, password });
    if (result.kind === 'created') {
      console.log('FIRST_ADMIN_CREATED: Initial Admin saved. Additional Admins require Dashboard access.');
    } else {
      printAvailability(result);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Never print database error dumps or credentials.
  const schemaMissing = ['P2021', 'P2022'].includes(error?.code) ||
    /does not exist|relation .* does not exist/i.test(error?.message || '');
  if (schemaMissing) {
    console.error('ADMIN_SCHEMA_NOT_READY: Bootstrap tables are missing. Review and apply the migration safely.');
  } else if (error instanceof AdminBootstrapError) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error('ADMIN_BOOTSTRAP_FAILED: Check the database connection and server logs (no secrets printed).');
  }
  process.exitCode = 1;
});
