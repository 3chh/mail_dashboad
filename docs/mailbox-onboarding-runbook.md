# Mailbox Onboarding Runbook

## Muc tieu

Tai lieu nay mo ta quy trinh onboarding mailbox ca nhan theo huong:

- Gmail dung Gmail API OAuth
- Hotmail/Outlook ca nhan dung Microsoft Graph OAuth
- moi mailbox consent 1 lan dau de lay `refresh token`
- server luu token da ma hoa va sync theo lich

## Pham vi

Phase dau:

- pilot voi `5 Gmail + 5 Hotmail`
- xac nhan consent, luu token, test sync, va scheduled sync

Phase sau:

- mo rong quy trinh len 500 mailbox

## Nguyen tac van hanh

- admin login vao web app bang tai khoan he thong rieng
- mailbox khong phai la tai khoan dang nhap vao web app
- moi mailbox la mot ban ghi rieng trong he thong
- moi mailbox co trang thai onboarding rieng

Trang thai de xuat:

- `DRAFT`
- `PENDING_CONSENT`
- `TOKEN_RECEIVED`
- `SYNC_TESTING`
- `ACTIVE`
- `ERROR`
- `RECONNECT_REQUIRED`

## Data can luu cho moi mailbox

- `emailAddress`
- `provider`
- `displayName`
- `externalUserId`
- `grantedScopes`
- `refreshTokenEncrypted`
- `accessTokenEncrypted` neu can cache tam
- `tokenExpiresAt`
- `consentedAt`
- `lastSyncedAt`
- `lastSyncCursor`
- `lastError`
- `status`

## Luong onboarding mailbox

### 1. Tao mailbox record

Admin nhap:

- email
- provider: `GMAIL` hoac `OUTLOOK`
- ghi chu neu can

He thong tao mailbox o trang thai `PENDING_CONSENT`.

### 2. Khoi tao OAuth session

He thong tao mot `state` record ngan han cho mailbox:

- `mailboxId`
- `provider`
- `state`
- `pkceVerifier` neu can
- `expiresAt`

Sau do redirect den provider consent page.

### 3. User login va consent

Chu tai khoan mailbox dang nhap va chap nhan scope doc mail.

Yeu cau:

- Gmail: xin scope doc mail toi thieu can thiet
- Outlook/Hotmail: xin `offline_access` va `Mail.Read`

### 4. Callback va doi token

Callback route can:

1. xac thuc `state`
2. exchange `code` thanh token
3. lay thong tin identity mailbox
4. ma hoa va luu `refresh token`
5. cap nhat mailbox sang `TOKEN_RECEIVED`

### 5. Test sync ngay sau consent

Ngay sau khi luu token:

1. goi provider adapter de test connection
2. list 10-20 message gan nhat
3. fetch 1-3 message de parse
4. luu local
5. chay OTP extractor

Neu thanh cong:

- mailbox sang `ACTIVE`

Neu that bai:

- mailbox sang `ERROR`
- luu `lastError`

### 6. Dua vao lich sync

Mailbox `ACTIVE` duoc dua vao job schedule.

Pilot khuyen nghi:

- sync incremental moi `5 phut`
- sync full nhe moi `24 gio`

## Checklist pilot 5 Gmail + 5 Hotmail

Cho moi mailbox:

1. tao record mailbox
2. connect provider
3. consent thanh cong
4. refresh token da luu
5. test sync thanh cong
6. da co it nhat 1 message local
7. OTP extractor chay on
8. scheduled sync chay lai thanh cong

Chi khi 10/10 mailbox qua checklist moi nen mo rong tiep.

## Tieu chi dat pilot

- 100% mailbox nhan duoc refresh token
- >= 90% scheduled sync thanh cong trong 24 gio
- khong co mailbox bi mat token vo ly do code
- search local tra du lieu dung tren tap mailbox da chon
- OTP lay duoc tu mailbox moi nhat da sync

## Quy trinh onboarding hang loat

Khi chuyen tu 10 mailbox sang 500 mailbox, khong doi luong ky thuat, chi doi cach van hanh.

### Lo onboarding

Nen chia thanh cac lo:

- lo 1: 25 mailbox
- lo 2: 50 mailbox
- lo 3: 100 mailbox

Khong nen onboarding 500 mailbox trong 1 lan dau.

### Cach van hanh

1. import danh sach mailbox
2. tao san mailbox record o trang thai `PENDING_CONSENT`
3. sinh onboarding link rieng cho tung mailbox
4. theo doi trang thai consent trong dashboard
5. auto test sync sau consent
6. dua mailbox dat yeu cau vao lich sync

### Dashboard can co

- so mailbox `pending consent`
- so mailbox `active`
- so mailbox `error`
- so mailbox `reconnect required`
- thoi diem sync gan nhat
- ly do loi gan nhat

## Xu ly su co

### Token bi revoke hoac het hieu luc

Dau hieu:

- refresh token that bai
- provider tra `invalid_grant` hoac loi tuong duong

Xu ly:

- set `RECONNECT_REQUIRED`
- tam dung sync mailbox do
- hien nut `Reconnect`

### Sync loi tam thoi

Vi du:

- network timeout
- provider rate limit

Xu ly:

- retry voi backoff
- giu mailbox o `ACTIVE` neu loi tam thoi

### Mailbox dang nhap sai tai khoan

Sau callback:

- so sanh email thuc te provider tra ve voi mailbox dang onboarding

Neu khac:

- khong luu token
- bao loi ro rang

## Bai test truoc khi mo rong

Can co it nhat cac bai test sau:

- consent callback luu dung mailbox
- khong the gan token cua mailbox A vao mailbox B
- refresh token duoc ma hoa truoc khi luu
- scheduled sync skip mailbox `ERROR` va `RECONNECT_REQUIRED`
- OTP quick refresh chi tac dong len mailbox duoc chon

## Buoc code nen lam ngay sau tai lieu nay

1. refactor schema sang `AdminUser + Mailbox + MailMessage + MailboxSyncJob`
2. them provider adapter cho Gmail API va Microsoft Graph
3. them page onboarding mailbox
4. them callback routes rieng cho Gmail va Outlook
5. them test sync action
6. them scheduled sync job
