import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DonationStatus, Role } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/response.js';
import { assertLiveAdmin } from './admin-account.service.js';
import { ADMIN_TRANSACTION_OPTIONS, lockAdminPrivileges } from './admin-bootstrap.service.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      donations: true,
      reports: true,
    },
  },
};

const adminDonationInclude = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
    },
  },
  images: {
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      reports: true,
    },
  },
};

const adminDonationDetailInclude = {
  ...adminDonationInclude,
  reports: {
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
    },
  },
};

const adminReportInclude = {
  reporter: {
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
    },
  },
  donation: {
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      },
      images: {
        orderBy: { createdAt: 'asc' },
      },
    },
  },
};

function donationImageDiskPath(imageUrl) {
  return path.resolve('uploads', 'donations', path.basename(imageUrl));
}

async function expirePastAdminDonations() {
  await prisma.donation.updateMany({
    where: { status: DonationStatus.AVAILABLE, endDate: { lt: new Date() } },
    data: { status: DonationStatus.EXPIRED },
  });
}
export function listAdminUsers() {
  return prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function setUserActive(userId, isActive, actingAdminId, db = prisma) {
  // All ADMIN status changes and ADMIN creation use the same global
  // transaction-level advisory lock. This prevents concurrent requests
  // from independently suspending the last two active administrators.
  const outcome = await db.$transaction(async (tx) => {
    await lockAdminPrivileges(tx);
    await assertLiveAdmin(tx, actingAdminId);

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบบัญชีผู้ใช้');
    }

    if (user.role === Role.ADMIN && !isActive && user.isActive) {
      let denial = null;
      if (userId === actingAdminId) {
        denial = { status: 400, code: 'CANNOT_SUSPEND_SELF',
          message: 'Admin ไม่สามารถระงับบัญชีตัวเองได้' };
      } else if ((await tx.user.count({
        where: { role: Role.ADMIN, isActive: true },
      })) <= 1) {
        denial = { status: 409, code: 'LAST_ACTIVE_ADMIN',
          message: 'ไม่สามารถระงับผู้ดูแลระบบคนสุดท้ายที่ยังใช้งานอยู่ได้' };
      }

      if (denial) {
        // Return rather than throw so the DENIED audit survives COMMIT.
        await tx.adminAuditLog.create({
          data: {
            id: randomUUID(), actorUserId: actingAdminId, targetUserId: userId,
            action: 'ADMIN_SUSPENDED', outcome: 'DENIED',
          },
        });
        return { denied: denial };
      }
    }

    // Preserve the original self-suspension guard even for already-inactive
    // targets; do not silently permit an invalid request.
    if (userId === actingAdminId && !isActive) {
      return { denied: { status: 400, code: 'CANNOT_SUSPEND_SELF',
        message: 'Admin ไม่สามารถระงับบัญชีตัวเองได้' } };
    }

    // No-op requests leave timestamps and audit trails unchanged.
    if (user.isActive === isActive) {
      return { user: await tx.user.findUnique({ where: { id: userId },
        select: userSelect }) };
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { isActive },
      select: userSelect,
    });

    if (user.role === Role.ADMIN) {
      await tx.adminAuditLog.create({
        data: {
          id: randomUUID(), actorUserId: actingAdminId, targetUserId: userId,
          action: isActive ? 'ADMIN_REACTIVATED' : 'ADMIN_SUSPENDED',
          outcome: 'SUCCESS',
        },
      });
    }
    return { user: updated };
  }, ADMIN_TRANSACTION_OPTIONS);

  if (outcome.denied) {
    const { status, code, message } = outcome.denied;
    throw new AppError(status, code, message);
  }
  return outcome.user;
}

export async function listAdminDonations() {
  await expirePastAdminDonations();
  return prisma.donation.findMany({
    include: adminDonationInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAdminDonation(donationId) {
  await expirePastAdminDonations();
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: adminDonationDetailInclude,
  });

  if (!donation) {
    throw new AppError(404, 'DONATION_NOT_FOUND', 'ไม่พบโพสต์บริจาค');
  }

  return donation;
}

export async function setDonationHidden(donationId, isHidden) {
  await expirePastAdminDonations();
  const donation = await prisma.donation.findUnique({ where: { id: donationId } });
  if (!donation) {
    throw new AppError(404, 'DONATION_NOT_FOUND', 'ไม่พบโพสต์บริจาค');
  }

  return prisma.donation.update({
    where: { id: donationId },
    data: { isHidden },
    include: adminDonationInclude,
  });
}

export async function deleteDonationAsAdmin(donationId) {
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    include: { images: true },
  });

  if (!donation) {
    throw new AppError(404, 'DONATION_NOT_FOUND', 'ไม่พบโพสต์บริจาค');
  }

  await prisma.donation.delete({ where: { id: donationId } });
  await Promise.all(
    donation.images.map((image) => unlink(donationImageDiskPath(image.imageUrl)).catch(() => {})),
  );
}

export async function listAdminReports() {
  await expirePastAdminDonations();
  return prisma.report.findMany({
    include: adminReportInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAdminReport(reportId) {
  await expirePastAdminDonations();
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: adminReportInclude,
  });

  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'ไม่พบรายงาน');
  }

  return report;
}

export async function setReportStatus(reportId, status) {
  await expirePastAdminDonations();
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'ไม่พบรายงาน');
  }

  return prisma.report.update({
    where: { id: reportId },
    data: { status },
    include: adminReportInclude,
  });
}
