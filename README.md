# Mailbox Center

Web app quan ly tap trung nhieu mailbox Gmail va Hotmail/Outlook ca nhan.

Kien truc hien tai da duoc refactor theo huong:

- admin dang nhap vao web app bang tai khoan he thong rieng
- moi mailbox Gmail / Hotmail consent 1 lan dau de lay `refresh token`
- server luu token da ma hoa
- he thong sync mail ve SQLite theo lich hoac sync tay
- search, OTP, order extraction doc tren local store

Phase hien tai duoc toi uu cho pilot:

- `5 Gmail`
- `5 Hotmail`

## Tinh nang hien co

- admin sign-in bang `CredentialsProvider`
- tao mailbox Gmail / Outlook trong dashboard
- connect tung mailbox qua Gmail API hoac Microsoft Graph OAuth
- luu `refresh token` da ma hoa vao database
- sync mailbox theo lo
- local search tren nhieu mailbox da chon
- OTP monitor theo mailbox
- order extraction theo mailbox
- export CSV cho order data

## Stack

- Next.js 16 App Router
- React 19
- NextAuth
- Prisma + SQLite
- Gmail API
- Microsoft Graph API
- Tailwind + shadcn/ui

## Kien truc chinh

Model du lieu chinh:

- `AdminUser`
- `Mailbox`
- `MailboxOAuthState`
- `MailMessage`
- `ScanJob`
- `OtpDetection`
- `OrderExtraction`

Provider layer:

- `lib/mail/adapters/gmail-api.ts`
- `lib/mail/adapters/microsoft-graph.ts`

Tai lieu lien quan:

- [RFC](C:/Users/Hp Victus/Desktop/demo_Gmail - Copy/docs/centralized-mail-platform-rfc.md)
- [Onboarding Runbook](C:/Users/Hp Victus/Desktop/demo_Gmail - Copy/docs/mailbox-onboarding-runbook.md)

## 1. Tao OAuth credentials

### Gmail API

1. Mo Google Cloud Console.
2. Tao project hoac chon project co san.
3. Enable Gmail API.
4. Tao `OAuth client ID` loai `Web application`.
5. Them redirect URI:

```txt
<APP_PUBLIC_URL>/api/oauth/google/callback
```

6. Lay `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET`.

Scope chinh:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.readonly`

### Microsoft Graph cho Hotmail / Outlook ca nhan

1. Mo Microsoft Entra / Azure app registrations.
2. Tao app registration ho tro `personal Microsoft accounts`.
3. Cau hinh redirect URI:

```txt
<APP_PUBLIC_URL>/api/oauth/outlook/callback
```

4. Tao client secret.
5. Cap delegated permissions:

- `openid`
- `email`
- `profile`
- `offline_access`
- `User.Read`
- `Mail.Read`

6. Lay `MICROSOFT_CLIENT_ID` va `MICROSOFT_CLIENT_SECRET`.

Khuyen nghi de `MICROSOFT_TENANT_ID=consumers`.

## 2. Cau hinh environment variables

Copy file mau:

```bash
copy .env.example .env
```

Can dien it nhat:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=consumers
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
ADMIN_NAME=Mailbox Admin
MAIL_TOKEN_SECRET=replace-with-a-second-long-random-string
CRON_SECRET=replace-with-a-cron-secret
NEXTAUTH_SECRET=replace-with-a-long-random-string
APP_PUBLIC_URL=http://localhost:3000
APP_INTERNAL_URL=http://127.0.0.1:3000
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
```

Ghi chu:

- `ADMIN_EMAIL` va `ADMIN_PASSWORD` duoc dung de bootstrap admin dau tien
- `MAIL_TOKEN_SECRET` duoc dung de ma hoa token mailbox trong database
- `CRON_SECRET` duoc dung cho endpoint cron sync
- `APP_PUBLIC_URL` la URL public duy nhat cua app, duoc dung cho redirect login va OAuth
- `APP_INTERNAL_URL` la URL noi bo de server goi lai chinh no neu can

Generate secret neu can:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Cai dependencies

```bash
npm install
```

## 4. Khoi tao database

Generate Prisma client:

```bash
npm run db:generate
```

Dong bo schema vao SQLite:

```bash
npx prisma db push
```

Neu can reset local DB trong luc dev:

```bash
npx prisma db push --force-reset
```

Mo Prisma Studio:

```bash
npm run db:studio
```

## 5. Chay app

```bash
npm run dev
```

Mo:

```txt
<APP_PUBLIC_URL>
```

## 6. Quy trinh pilot 5 Gmail + 5 Hotmail

### Dang nhap admin

1. Mo `<APP_PUBLIC_URL>`.
2. Dang nhap bang `ADMIN_EMAIL` va `ADMIN_PASSWORD`.

### Tao mailbox

1. Vao `Dashboard`.
2. Nhap email mailbox.
3. Chon `Gmail` hoac `Hotmail / Outlook`.
4. Bam `Them mailbox`.

### Consent tung mailbox

1. Tai dong mailbox, bam `Connect`.
2. Dang nhap dung account mailbox.
3. Chap nhan scope doc mail.
4. Sau callback thanh cong, mailbox se chuyen sang `ACTIVE` neu token duoc luu.

Luu y:

- Gmail ca nhan va Hotmail ca nhan deu can consent tung mailbox mot lan dau
- sau do server se giu refresh token va khong can login lai moi ngay

### Test sync

1. Chon 1 hoac nhieu mailbox tren dashboard.
2. Chon sync window `1`, `7`, hoac `30` ngay.
3. Bam `Sync selected`.
4. Mo `Sync Jobs` de theo doi tien do.

### Search local

1. Chon mailbox tren dashboard hoac trong trang `Search`.
2. Tim theo keyword, sender, date, unread, attachment.
3. Ket qua doc tu local DB, khong fetch live provider trong request nay.

### OTP

1. Vao `OTP`.
2. Chon mailbox.
3. Loc sender / date / unread neu can.
4. Copy OTP tu local detections.

### Orders

1. Vao `Orders`.
2. Chon mailbox.
3. Review merchant, amount, status, item summary.
4. Export CSV neu can.

## 7. Scheduled sync

App da co endpoint cron co ban:

```txt
POST /api/cron/sync
```

Can header:

```txt
Authorization: Bearer <CRON_SECRET>
```

Hien tai endpoint nay:

- lay mailbox `ACTIVE`
- bo qua mailbox moi sync trong 5 phut gan nhat
- xep job sync co ban

Day la skeleton cho pilot. Neu len production, can doi sang queue ben vung hon.

## 8. Cac file quan trong

```txt
app/(app)/dashboard/page.tsx
app/(auth)/sign-in/page.tsx
app/api/mailboxes/route.ts
app/api/oauth/google/start/route.ts
app/api/oauth/google/callback/route.ts
app/api/oauth/outlook/start/route.ts
app/api/oauth/outlook/callback/route.ts
app/api/scan-jobs/route.ts
app/api/cron/sync/route.ts
lib/auth/auth-options.ts
lib/auth/admin.ts
lib/mail/adapters/gmail-api.ts
lib/mail/adapters/microsoft-graph.ts
lib/mail/service.ts
lib/jobs/scan-runner.ts
prisma/schema.prisma
```

## 9. Ghi chu ky thuat

- app hien tai dung in-process sync jobs de test pilot nhanh
- search / OTP / orders la local-first
- refresh token duoc ma hoa, khong luu plain text
- schema cu Gmail-demo khong con phu hop voi code hien tai

## 10. Han che hien tai

- chua co queue ben vung nhu BullMQ
- chua co batch onboarding tool cho 500 mailbox
- chua co reconnect UX day du cho token bi revoke
- chua co auto incremental sync chuan hoa theo cursor/history/delta
- chua co telemetry va rate-limit handling muc production

## 11. Huong tiep theo

Sau pilot, nen lam tiep:

1. queue ben vung cho sync jobs
2. retry policy + backoff
3. reconnect flow ro rang cho mailbox loi
4. dashboard theo doi stale mailbox / token revoke
5. batch onboarding workflow cho nhieu mailbox
