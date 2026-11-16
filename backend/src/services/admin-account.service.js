import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/response.js';
import {
  ADMIN_TRANSACTION_OPTIONS,
  lockAdminPrivileges,
  validateBootstrapCredentials,
  AdminBootstrapError,
} from './admin-bootstrap.service.js';

// Public ADMIN DTO fields only. Never include passwordHash or tokens.
export const adminUserSelect = {
  id: true, name: true, email: true, role: true, isActive: true,
  createdAt: true, updatedAt: true,
  _count: { select: { donations: true, reports: true } },
};

export async function assertLiveAdmin(tx, actorId) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, isActive: true },
  });
  if (!actor || actor.role !== Role.ADMIN || !actor.isActive) {
    throw new AppError(403, 'ADMIN_ACCESS_REVOKED', 'บัญชีผู้ดูแลไม่มีสิทธิ์ดำเนินการ');
  }
  return actor;
}

/** Add another ADMIN after the one-time CLI bootstrap.
 * Auth+ADMIN role is also verified by the HTTP router, and then re-verified
 * inside the locked transaction to protect against a mid-request suspension. */
export async function createAdditionalAdmin(input, actorId, db = prisma) {
  let credentials;
  try {
    credentials = validateBootstrapCredentials(input);
  } catch (error) {
    if (error instanceof AdminBootstrapError) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ข้อมูลผู้ดูแลไม่ถูกต้อง');
    }
    throw error;
  }
  const { name, email, password } = credentials;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    return await db.$transaction(async (tx) => {
      await lockAdminPrivileges(tx);
      await assertLiveAdmin(tx, actorId);
      const marker = await tx.adminBootstrapState.findUnique({ where: { id: 1 } });
      if (!marker) {
        throw new AppError(409, 'ADMIN_BOOTSTRAP_REQUIRED',
          'ต้องตั้งค่าผู้ดูแลคนแรกผ่าน CLI ให้เสร็จก่อน');
      }
      const existing = await tx.user.findUnique({
        where: { email }, select: { id: true },
      });
      if (existing) {
        throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'อีเมลนี้ถูกใช้งานแล้ว');
      }
      const admin = await tx.user.create({
        data: { name, email, passwordHash, role: Role.ADMIN, isActive: true },
        select: adminUserSelect,
      });
      await tx.adminAuditLog.create({
        data: {
          id: randomUUID(),
          actorUserId: actorId,
          targetUserId: admin.id,
          action: 'ADMIN_CREATED',
          outcome: 'SUCCESS',
        },
      });
      return admin;
    }, ADMIN_TRANSACTION_OPTIONS);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'อีเมลนี้ถูกใช้งานแล้ว');
    }
    throw error;
  }
}
