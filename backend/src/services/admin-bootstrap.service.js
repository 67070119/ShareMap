import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';

/**
 * Shared privilege-management lock reserved for first-admin bootstrap (P2)
 * and future admin create/suspend actions (P3).
 * Serialize ALL privilege mutations with the same transaction advisory lock.
 */
export const ADMIN_PRIVILEGE_LOCK_KEY = 7240616026n;
export const ADMIN_TRANSACTION_OPTIONS = Object.freeze({ maxWait: 10000, timeout: 15000 });
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AdminBootstrapError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminBootstrapError';
    this.code = code;
  }
}

export function validateBootstrapCredentials({ name, email, password } = {}) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    throw new AdminBootstrapError('INVALID_NAME', 'Name must be 2-80 characters.');
  }
  if (typeof email !== 'string' || email.trim().length > 254 ||
      !EMAIL_PATTERN.test(email.trim())) {
    throw new AdminBootstrapError('INVALID_EMAIL', 'Enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72 ||
      Buffer.byteLength(password, 'utf8') > 72 || /[\u0000-\u001f\u007f]/.test(password)) {
    throw new AdminBootstrapError('INVALID_PASSWORD',
      'Password must be 8-72 characters (at most 72 UTF-8 bytes), without control characters.');
  }
  return { name: name.trim(), email: email.trim().toLowerCase(), password };
}

export async function lockAdminPrivileges(tx) {
  // The transaction holds this lock through COMMIT/ROLLBACK, including the audit insert.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ADMIN_PRIVILEGE_LOCK_KEY}::bigint)::text AS locked`;
}

async function checkLockedBootstrap(tx) {
  const marker = await tx.adminBootstrapState.findUnique({ where: { id: 1 } });
  if (marker) return { kind: 'already_completed', source: marker.source };
  const legacy = await tx.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!legacy) return { kind: 'available' };

  // Fail closed and permanently record legacy state if marker was absent.
  // Commit the legacy adoption instead of throwing and rolling back the marker.
  await tx.adminBootstrapState.create({
    data: { id: 1, source: 'LEGACY_ADMIN', initialAdminId: legacy.id },
  });
  await tx.adminAuditLog.create({
    data: {
      id: randomUUID(),
      actorUserId: null,
      targetUserId: legacy.id,
      action: 'LEGACY_ADMIN_ADOPTION',
      outcome: 'SUCCESS',
    },
  });
  return { kind: 'legacy_adopted' };
}

/** Readiness preflight: if a legacy ADMIN exists, adopt it atomically without
 * changing any User row. Call before collecting credentials in the terminal. */
export function inspectInitialAdminStatus(prisma) {
  return prisma.$transaction(async (tx) => {
    await lockAdminPrivileges(tx);
    return checkLockedBootstrap(tx);
  }, ADMIN_TRANSACTION_OPTIONS);
}

/** One-time creation, with a SECOND check under the same DB advisory lock.
 * Hashing runs before acquiring the lock, so unrelated transactions are not
 * stalled by the bcrypt CPU work.
 * NEVER call from public HTTP code; initial Admin is a CLI-only capability. */
export async function bootstrapFirstAdmin(prisma, input) {
  const { name, email, password } = validateBootstrapCredentials(input);
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.$transaction(async (tx) => {
    await lockAdminPrivileges(tx);
    const status = await checkLockedBootstrap(tx);
    if (status.kind !== 'available') return status;

    // Recheck email under lock, unique index remains the final arbiter.
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new AdminBootstrapError('EMAIL_ALREADY_EXISTS',
        'This email is already registered. Choose an unused email.');
    }
    const admin = await tx.user.create({
      data: { name, email, passwordHash, role: Role.ADMIN, isActive: true },
      select: { id: true, email: true },
    });
    await tx.adminBootstrapState.create({
      data: { id: 1, source: 'CLI', initialAdminId: admin.id },
    });
    await tx.adminAuditLog.create({
      data: {
        id: randomUUID(),
        // CLI operator is an OS principal, not an authenticated User.
        // Do not misattribute this action to the newly created Admin.
        actorUserId: null,
        targetUserId: admin.id,
        action: 'INITIAL_ADMIN_BOOTSTRAP',
        outcome: 'SUCCESS',
      },
    });
    return { kind: 'created', adminId: admin.id, email: admin.email };
  }, ADMIN_TRANSACTION_OPTIONS);
}
