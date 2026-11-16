-- Phase 1: additive-only schema; NO updates/deletes to legacy User data.
-- The initial ADMIN (including suspended ADMIN) permanently locks CLI bootstrap.
CREATE TYPE "AdminBootstrapSource" AS ENUM ('CLI', 'LEGACY_ADMIN');
CREATE TYPE "AdminAuditAction" AS ENUM (
  'INITIAL_ADMIN_BOOTSTRAP',
  'LEGACY_ADMIN_ADOPTION',
  'ADMIN_CREATED',
  'ADMIN_SUSPENDED',
  'ADMIN_REACTIVATED'
);
CREATE TYPE "AdminAuditOutcome" AS ENUM ('SUCCESS', 'DENIED');

CREATE TABLE "AdminBootstrapState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "source" "AdminBootstrapSource" NOT NULL,
  "initialAdminId" TEXT NOT NULL,
  "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminBootstrapState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminBootstrapState_singleton_check" CHECK ("id" = 1)
);

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "action" "AdminAuditAction" NOT NULL,
  "outcome" "AdminAuditOutcome" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");
CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");

-- Import existing ADMIN role holders without touching their credentials/status.
-- Includes inactive ADMIN: otherwise removal/suspension could unlock bootstrap.
-- Stable ordering yields deterministic provenance when multiple legacy admins exist.
INSERT INTO "AdminBootstrapState" ("id", "source", "initialAdminId")
SELECT 1, 'LEGACY_ADMIN'::"AdminBootstrapSource", legacy."id"
FROM "User" AS legacy
WHERE legacy."role" = 'ADMIN'
ORDER BY legacy."createdAt" ASC, legacy."id" ASC
LIMIT 1
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AdminAuditLog" (
  "id", "actorUserId", "targetUserId", "action", "outcome"
)
SELECT
  'legacy-admin-adoption-' || state."initialAdminId",
  NULL,
  state."initialAdminId",
  'LEGACY_ADMIN_ADOPTION'::"AdminAuditAction",
  'SUCCESS'::"AdminAuditOutcome"
FROM "AdminBootstrapState" AS state
WHERE state."id" = 1 AND state."source" = 'LEGACY_ADMIN';
