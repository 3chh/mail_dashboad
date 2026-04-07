-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("provider", "providerAccountId"),
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "jobName" TEXT,
    "dateRangeDays" INTEGER,
    "customQuery" TEXT,
    "effectiveQuery" TEXT,
    "totalMessagesFound" INTEGER NOT NULL DEFAULT 0,
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "otpDetectionsFound" INTEGER NOT NULL DEFAULT 0,
    "orderExtractionsFound" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScanJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scanJobId" TEXT,
    "gmailMessageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "fromHeader" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "internalDate" DATETIME,
    "plainTextBody" TEXT,
    "htmlBody" TEXT,
    "normalizedText" TEXT,
    "labels" TEXT,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "sizeEstimate" INTEGER,
    "rawHeadersJson" TEXT,
    "rawPayloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GmailMessage_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtpDetection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "confidenceScore" REAL NOT NULL,
    "confidenceLabel" TEXT NOT NULL,
    "matchedKeywordsJson" TEXT,
    "contextSnippet" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OtpDetection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OtpDetection_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GmailMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderExtraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderDate" DATETIME,
    "merchantName" TEXT,
    "customerName" TEXT,
    "totalAmount" REAL,
    "currency" TEXT,
    "orderStatus" TEXT,
    "itemSummary" TEXT,
    "sourceSubject" TEXT,
    "sourceSender" TEXT,
    "receivedAt" DATETIME,
    "confidenceScore" REAL NOT NULL,
    "confidenceLabel" TEXT NOT NULL,
    "debugJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderExtraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderExtraction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GmailMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "scanJobId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "contextJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExtractionLog_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_provider_idx" ON "Account"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "ScanJob_userId_createdAt_idx" ON "ScanJob"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ScanJob_status_idx" ON "ScanJob"("status");

-- CreateIndex
CREATE INDEX "GmailMessage_userId_internalDate_idx" ON "GmailMessage"("userId", "internalDate" DESC);

-- CreateIndex
CREATE INDEX "GmailMessage_userId_fromEmail_idx" ON "GmailMessage"("userId", "fromEmail");

-- CreateIndex
CREATE UNIQUE INDEX "GmailMessage_userId_gmailMessageId_key" ON "GmailMessage"("userId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "OtpDetection_userId_detectedAt_idx" ON "OtpDetection"("userId", "detectedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OtpDetection_messageId_code_key" ON "OtpDetection"("messageId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExtraction_messageId_key" ON "OrderExtraction"("messageId");

-- CreateIndex
CREATE INDEX "OrderExtraction_userId_receivedAt_idx" ON "OrderExtraction"("userId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "OrderExtraction_merchantName_idx" ON "OrderExtraction"("merchantName");

-- CreateIndex
CREATE INDEX "ExtractionLog_scanJobId_createdAt_idx" ON "ExtractionLog"("scanJobId", "createdAt" DESC);
