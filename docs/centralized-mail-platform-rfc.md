# Centralized Mail Platform RFC

## Boi canh

Codebase hien tai dang giai bai toan:

- user dang nhap bang Google
- user chi doc mailbox Gmail cua chinh user do
- moi message, OTP, order, scan job deu gan truc tiep voi `User`

Yeu cau moi da doi thanh:

- user trong he thong la `admin`, khong can la tai khoan Google
- he thong quan ly tap trung nhieu mailbox khac nhau
- mailbox co the la Gmail va Hotmail/Outlook ca nhan
- search la search tren tap mailbox duoc chon trong dashboard
- OTP la lay tu mailbox duoc chon, uu tien mail moi nhat trong mailbox do
- quy mo muc tieu den khoang 500 mailbox

Dieu nay khong con la mo hinh "end-user Gmail OAuth app". Day la mo hinh "admin-operated mailbox aggregation platform".

## Ket luan kien truc

Can refactor tu mo hinh `User -> Gmail data` sang:

- `AdminUser` de dang nhap vao web app
- `Mailbox` de dai dien tung hop thu duoc quan ly
- `MailboxCredential` hoac `MailboxConnection` de luu cach ket noi toi provider
- `MailMessage` la du lieu mail da duoc dong bo ve he thong
- `ScanJob` chay tren nhieu mailbox, khong chay tren 1 user Google
- `OtpDetection` va `OrderExtraction` gan voi `MailMessage`

## Huong tiep can provider

Khuyen nghi dung provider abstraction.

Interface toi thieu:

```ts
type MailProviderAdapter = {
  listMessageRefs(input: { mailboxId: string; query?: string; cursor?: string; limit: number }): Promise<{
    refs: Array<{ remoteId: string; threadId?: string | null }>;
    nextCursor: string | null;
    estimatedTotal?: number | null;
  }>;
  getMessage(input: { mailboxId: string; remoteId: string }): Promise<NormalizedRemoteMessage>;
  testConnection(input: { mailboxId: string }): Promise<{ ok: boolean; message?: string }>;
};
```

Nen co it nhat 2 adapter:

- `gmail-api-adapter`
- `microsoft-graph-adapter`

### Lua chon provider cho bai toan nay

Huong duoc chot:

- Gmail dung `Gmail API`
- Hotmail/Outlook ca nhan dung `Microsoft Graph`
- khong dung IMAP lam huong chinh

Ly do:

- sync incremental tot hon
- metadata va labels/folders ro rang hon
- auth an toan hon vi dung OAuth token thay cho password/app password
- phu hop voi mo hinh `scheduled sync + local search`

### Rang buoc quan trong voi mailbox ca nhan

Voi Gmail ca nhan va Hotmail ca nhan:

- khong co co che "1 token tong" cho tat ca mailbox
- can onboarding tung mailbox mot lan dau de lay `refresh token`
- server giu `refresh token` da ma hoa va tu refresh `access token` khi sync

Dieu nay co nghia la muc tieu 500 mailbox van kha thi, nhung quy trinh phai la:

1. login mailbox
2. consent cho app
3. luu refresh token
4. test sync
5. dua vao lich dong bo

Khong can 500 nguoi login lai moi ngay. Chi can consent lan dau, sau do van hanh bang token luu tren server.

## Search va OTP

### Search

Khong nen query truc tiep tung provider moi khi user bam search tren 500 mailbox.

Nen lam:

1. Dong bo mail metadata va body ve local database theo lich
2. Search tren local store
3. Chi fetch live khi admin yeu cau refresh hoac message chua duoc hydrate day du

Ly do:

- nhanh hon
- co the search dong thoi tren nhieu mailbox
- giam rate limit
- de them bo loc, phan quyen, dashboard thong ke

### OTP

OTP page khong nen scan toan bo live tren moi click.

Nen lam:

- admin chon 1 hoac nhieu mailbox
- he thong loc mail moi nhat theo mailbox da sync
- uu tien inbox/unread/recent window
- hien OTP moi nhat co confidence cao nhat cho tung mailbox

Neu can thao tac "lay OTP moi nhat ngay lap tuc", endpoint OTP co the:

1. trigger quick sync cho mailbox duoc chon
2. nap message moi nhat tu provider cua mailbox do
3. chay extractor
4. tra ve OTP moi nhat

## UI/UX de chon mailbox

Dashboard can doi tu "dashboard cho 1 Google account" sang "mailbox control center".

Can co:

- bang mailbox co checkbox
- `select all`
- `shift-click` de chon range
- co bo loc theo provider, nhan, trang thai, keyword
- co bulk actions: `sync`, `search`, `fetch otp`, `disable`

Neu muon cam giac giong Excel:

- dung table client component
- luu `lastSelectedIndex`
- support `Shift + click`
- support drag selection la phase 2, khong nen lam ngay neu chua can

## Queue va scale

`setTimeout` in-process nhu hien tai khong du cho 500 mailbox.

Can doi sang durable job runner:

- Redis + BullMQ, hoac
- database-backed queue, hoac
- external worker process

Toi thieu can co 3 job type:

- `mailbox-sync-job`
- `mailbox-search-index-job`
- `mailbox-otp-refresh-job`

Muc tieu:

- co retry
- co concurrency control theo mailbox
- khong scan 2 job cung mailbox cung luc
- co log theo mailbox va theo batch

## De xuat data model

Schema moi nen theo huong sau:

```prisma
enum AdminRole {
  SUPER_ADMIN
  OPERATOR
}

enum MailProvider {
  GMAIL
  OUTLOOK
}

enum MailboxStatus {
  ACTIVE
  ERROR
  DISABLED
}

enum MailboxAuthType {
  OAUTH
}

model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  role         AdminRole @default(OPERATOR)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     Session[]
  createdMailboxes Mailbox[] @relation("MailboxCreatedBy")
}

model Mailbox {
  id              String          @id @default(cuid())
  emailAddress    String          @unique
  displayName     String?
  provider        MailProvider
  authType        MailboxAuthType
  status          MailboxStatus   @default(ACTIVE)
  externalUserId  String?
  accessTokenEncrypted String?
  refreshTokenEncrypted String?
  tokenExpiresAt  DateTime?
  grantedScopes   String?
  consentedAt     DateTime?
  lastSyncedAt    DateTime?
  lastSyncCursor  String?
  lastError       String?
  createdById     String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  createdBy       AdminUser?      @relation("MailboxCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  messages        MailMessage[]
  syncJobs        MailboxSyncJob[]
}

model MailMessage {
  id               String   @id @default(cuid())
  mailboxId        String
  remoteMessageId  String
  remoteThreadId   String?
  fromName         String?
  fromEmail        String?
  fromHeader       String?
  subject          String?
  snippet          String?
  receivedAt       DateTime?
  normalizedText   String?
  labels           String?
  hasAttachments   Boolean  @default(false)
  rawHeadersJson   String?
  rawPayloadJson   String?
  syncedAt         DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  mailbox          Mailbox  @relation(fields: [mailboxId], references: [id], onDelete: Cascade)
  otpDetections    OtpDetection[]
  orderExtractions OrderExtraction[]

  @@unique([mailboxId, remoteMessageId])
  @@index([mailboxId, receivedAt(sort: Desc)])
  @@index([fromEmail])
}
```

Can doi tat ca query hien tai tu `where: { userId }` sang `where: { mailboxId: { in: [...] } }` hoac join qua `mailbox`.

Can them bang job va log theo mailbox, vi sync se khong con la "scan 1 user" nhu hien tai.

## Cac thay doi code bat buoc

### 1. Auth

Bo rang buoc "dang nhap bang Google de vao app".

Thay bang:

- `CredentialsProvider` cho admin
- hoac auth rieng bang bang `AdminUser`

Google OAuth, neu con dung, chi con la mot kieu ket noi mailbox, khong phai auth cua admin.

### 2. Service layer

File `lib/gmail/*` can doi thanh `lib/mail/*`.

De xuat:

- `lib/mail/adapters/gmail-api.ts`
- `lib/mail/adapters/microsoft-graph.ts`
- `lib/mail/service.ts`
- `lib/mail/parser.ts`
- `lib/mail/query.ts`
- `lib/mail/token-vault.ts`

### 3. Queries

Tat ca dashboard/query page hien tai deu dang nhan `session.user.id`.

Can doi sang:

- `selectedMailboxIds` tu query string, form, hoac session state
- aggregate theo mailbox

### 4. Jobs

`ScanJob` hien tai la "scan 1 user".

Can doi thanh:

- batch scan nhieu mailbox
- luu danh sach mailbox duoc scan
- log tren tung mailbox
- support `scheduled full sync` va `incremental sync`

### 5. Search page

Can them:

- mailbox selector
- ket qua hien mailbox nguon
- search local index thay vi goi Gmail live

### 6. OTP page

Can them:

- chon mailbox
- action `Lay OTP moi nhat`
- tra ve OTP moi nhat theo mailbox

### 7. Onboarding page

Can them:

- tao mailbox record o trang thai `PENDING_CONSENT`
- link `Connect Gmail` / `Connect Outlook`
- callback route de luu token
- test sync ngay sau consent
- cap nhat trang thai `ACTIVE` hoac `ERROR`

## Lo trinh implementation

### Phase 1

- them admin auth doc lap voi Google
- them `Mailbox` model
- them `MailboxOAuthSession` hoac `state` verifier cho flow consent
- them Gmail API adapter
- them Microsoft Graph adapter
- them onboarding page cho mailbox
- test tren 5 Gmail + 5 Hotmail
- tao mailbox dashboard voi multi-select
- refactor du lieu da luu de gan voi mailbox thay vi user
- scheduled sync cho pilot mailbox set

### Phase 2

- them quick sync theo mailbox
- search local tren nhieu mailbox
- OTP moi nhat theo mailbox
- auto refresh token va xu ly reconnect
- batch onboarding tools cho nhieu mailbox

### Phase 3

- queue ben vung
- bulk sync 500 mailbox
- health monitoring
- rate limit va retry policy
- webhook/push neu can, nhung khong bat buoc o phase dau

## Nhung diem can chot truoc khi code sau

1. Co chap nhan luu `refresh token` da ma hoa trong database khong?
2. Search co can full-text ranking hay chi can `contains` + bo loc?
3. OTP co can tra ve 1 ma duy nhat moi nhat cho moi mailbox, hay tra danh sach ung vien?
4. Lich sync pilot se la bao lau mot lan: 1 phut, 5 phut, hay 15 phut?

## Danh gia repo hien tai

Nhung phan con tai su dung duoc:

- parser mail
- OTP extractor
- order extractor
- base UI va layout

Nhung phan nen thay the:

- auth Google login
- schema gan voi `User`
- Gmail live search page
- in-process scan queue

## Huong khuyen nghi

Khuyen nghi khong patch tiep tren mo hinh cu theo kieu "them Hotmail vao". Neu lam vay, code se bi khoa cung vao `User + Google + Gmail API`.

Huong dung la:

- doi auth cua admin ra khoi mailbox provider
- dua provider ve adapter layer
- chuyen search/OTP sang mailbox-centric
- dong bo du lieu ve local store de van hanh tap trung
- onboarding tung mailbox de lay refresh token
- sync theo lich thay vi fetch live lien tuc

## Mo hinh van hanh du kien

### Pilot

Pilot dau tien se gom:

- 5 Gmail ca nhan
- 5 Hotmail ca nhan

Tung mailbox di qua chu trinh:

1. tao mailbox trong admin dashboard
2. bam `Connect`
3. login va consent
4. luu refresh token
5. chay test sync
6. dua vao lich dong bo

### Muc tieu pilot

- xac nhan consent flow va callback hoat dong on dinh
- xac nhan refresh token duoc luu va refresh lai thanh cong
- xac nhan scheduled sync hoat dong lien tuc
- xac nhan search local va OTP tu local data dat nhu cau

### Mo rong len 500 mailbox

Neu pilot dat:

- giu nguyen flow consent per mailbox
- them batch tracking cho onboarding
- them job queue ben vung
- them dashboard theo doi mailbox loi, token revoke, va sync stale
