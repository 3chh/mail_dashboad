-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('DRAFT', 'PENDING_CONSENT', 'ACTIVE', 'ERROR', 'DISABLED', 'RECONNECT_REQUIRED');

-- CreateEnum
CREATE TYPE "MailboxAuthType" AS ENUM ('OAUTH');

-- CreateEnum
CREATE TYPE "ScanJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConfidenceLabel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "MailboxGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "normalizedAddress" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mailbox" (
    "id" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "provider" "MailProvider" NOT NULL,
    "authType" "MailboxAuthType" NOT NULL DEFAULT 'OAUTH',
    "status" "MailboxStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "externalUserId" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "grantedScopes" TEXT,
    "consentedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncCursor" TEXT,
    "lastError" TEXT,
    "notes" TEXT,
    "groupId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxOAuthState" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "provider" "MailProvider" NOT NULL,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailboxOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "mailboxId" TEXT NOT NULL,
    "status" "ScanJobStatus" NOT NULL DEFAULT 'QUEUED',
    "jobName" TEXT,
    "syncWindowDays" INTEGER,
    "effectiveQuery" TEXT,
    "totalMessagesFound" INTEGER NOT NULL DEFAULT 0,
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "otpDetectionsFound" INTEGER NOT NULL DEFAULT 0,
    "orderExtractionsFound" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "scanJobId" TEXT,
    "remoteMessageId" TEXT NOT NULL,
    "remoteThreadId" TEXT,
    "provider" "MailProvider" NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "fromHeader" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "receivedAt" TIMESTAMP(3),
    "plainTextBody" TEXT,
    "htmlBody" TEXT,
    "normalizedText" TEXT,
    "labels" TEXT,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "sizeEstimate" INTEGER,
    "rawHeadersJson" TEXT,
    "rawPayloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpDetection" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceLabel" "ConfidenceLabel" NOT NULL,
    "matchedKeywordsJson" TEXT,
    "contextSnippet" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExtraction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderDate" TIMESTAMP(3),
    "merchantName" TEXT,
    "customerName" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "currency" TEXT,
    "orderStatus" TEXT,
    "itemSummary" TEXT,
    "sourceSubject" TEXT,
    "sourceSender" TEXT,
    "receivedAt" TIMESTAMP(3),
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceLabel" "ConfidenceLabel" NOT NULL,
    "debugJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "mailboxId" TEXT,
    "scanJobId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contextJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailboxGroup_name_key" ON "MailboxGroup"("name");

-- CreateIndex
CREATE INDEX "MailboxGroup_createdById_name_idx" ON "MailboxGroup"("createdById", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- CreateIndex
CREATE INDEX "Warehouse_createdById_name_idx" ON "Warehouse"("createdById", "name");

-- CreateIndex
CREATE INDEX "Warehouse_normalizedAddress_idx" ON "Warehouse"("normalizedAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mailbox_emailAddress_key" ON "Mailbox"("emailAddress");

-- CreateIndex
CREATE INDEX "Mailbox_groupId_idx" ON "Mailbox"("groupId");

-- CreateIndex
CREATE INDEX "Mailbox_provider_status_idx" ON "Mailbox"("provider", "status");

-- CreateIndex
CREATE INDEX "Mailbox_status_lastSyncedAt_idx" ON "Mailbox"("status", "lastSyncedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MailboxOAuthState_state_key" ON "MailboxOAuthState"("state");

-- CreateIndex
CREATE INDEX "MailboxOAuthState_mailboxId_provider_idx" ON "MailboxOAuthState"("mailboxId", "provider");

-- CreateIndex
CREATE INDEX "MailboxOAuthState_expiresAt_idx" ON "MailboxOAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "ScanJob_mailboxId_createdAt_idx" ON "ScanJob"("mailboxId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ScanJob_status_idx" ON "ScanJob"("status");

-- CreateIndex
CREATE INDEX "MailMessage_mailboxId_receivedAt_idx" ON "MailMessage"("mailboxId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "MailMessage_mailboxId_fromEmail_idx" ON "MailMessage"("mailboxId", "fromEmail");

-- CreateIndex
CREATE INDEX "MailMessage_provider_receivedAt_idx" ON "MailMessage"("provider", "receivedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_mailboxId_remoteMessageId_key" ON "MailMessage"("mailboxId", "remoteMessageId");

-- CreateIndex
CREATE INDEX "OtpDetection_detectedAt_idx" ON "OtpDetection"("detectedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OtpDetection_messageId_code_key" ON "OtpDetection"("messageId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExtraction_messageId_key" ON "OrderExtraction"("messageId");

-- CreateIndex
CREATE INDEX "OrderExtraction_receivedAt_idx" ON "OrderExtraction"("receivedAt" DESC);

-- CreateIndex
CREATE INDEX "OrderExtraction_merchantName_idx" ON "OrderExtraction"("merchantName");

-- CreateIndex
CREATE INDEX "ExtractionLog_scanJobId_createdAt_idx" ON "ExtractionLog"("scanJobId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ExtractionLog_mailboxId_createdAt_idx" ON "ExtractionLog"("mailboxId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "MailboxGroup" ADD CONSTRAINT "MailboxGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MailboxGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxOAuthState" ADD CONSTRAINT "MailboxOAuthState_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpDetection" ADD CONSTRAINT "OtpDetection_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExtraction" ADD CONSTRAINT "OrderExtraction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionLog" ADD CONSTRAINT "ExtractionLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionLog" ADD CONSTRAINT "ExtractionLog_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionLog" ADD CONSTRAINT "ExtractionLog_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

