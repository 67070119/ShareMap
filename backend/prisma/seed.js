import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';

/**
 * DEVELOPMENT-ONLY demo USER creation.
 * NEVER create/promote/reactivate an ADMIN, nor modify an existing account.
 * First Admin: manual CLI bootstrap. Further Admins: protected Dashboard.
 */
// Prevent demo-account seeding in deployed production containers.
if (process.env.NODE_ENV === 'production') {
  throw new Error('DEMO_SEED_DISABLED_IN_PRODUCTION: Seed is development/test only.');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for seed');
}
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'user@ogtb.local';
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    console.log('Demo user already exists; it was left unchanged.');
    return;
  }
  const password = process.env.SEED_USER_PASSWORD || randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await prisma.user.create({
      data: {
        name: 'OGTB User',
        email,
        passwordHash,
        role: Role.USER,
        isActive: true,
      },
    });
    console.log('Demo USER created; no ADMIN account was created or changed.');
  } catch (error) {
    // Concurrent seed is idempotent; any existing email (USER or ADMIN) is untouched.
    if (error?.code === 'P2002') {
      console.log('Demo user already exists; it was left unchanged.');
      return;
    }
    throw error;
  }
}

main().then(async () => prisma.$disconnect()).catch(async () => {
  console.error('SEED_FAILED: Database unavailable or could not seed demo USER.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
