import { OmniLogin } from "@omnilogin/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountLine = {
  proxyId: number;
  email: string;
  password: string;
  productCode: string;
};

export type SSEEvent =
  | { type: "log"; label: string; message: string; level?: "info" | "warn" | "error" }
  | { type: "result"; label: string; success: boolean; step?: string; stepLabel?: string; error?: string }
  | { type: "done" };

export type RunParams = {
  accounts: string;
  otpUrl: string;
  otpKey: string;
  omniHost: string;
  send: (event: SSEEvent) => void;
};

type LoginOutcome = "success" | "mfa" | "wrong_password" | "captcha_fail" | "form_not_found";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOGIN_URL = "https://www.pokemoncenter-online.com/login/";
const ORDER_URL = "https://www.pokemoncenter-online.com/order-history/";

export const STATUS_MAP: Record<string, { stepLabel: string; step: string }> = {
  "注文受付済み": { step: "step1", stepLabel: "Đã tiếp nhận đơn" },
  "発送準備中":   { step: "step2", stepLabel: "Đang chuẩn bị giao" },
  "発送済み":     { step: "step3", stepLabel: "Đã giao hàng" },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isMfaUrl(url: string): boolean {
  return (
    url.includes("/login-mfa") ||
    url.includes("/mfa") ||
    url.includes("/otp") ||
    url.includes("/two-factor") ||
    url.includes("/verify")
  );
}

async function humanType(page: any, locator: any, text: string): Promise<void> {
  await locator.click();
  try { await locator.fill(""); } catch {}
  await page.waitForTimeout(rand(400, 900));
  await locator.pressSequentially(text, { delay: rand(80, 180) });
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

async function fetchOtp(email: string, otpApi: string, otpToken: string): Promise<string | null> {
  try {
    const res = await fetch(otpApi, {
      method: "POST",
      headers: { Authorization: `Bearer ${otpToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ emailAddress: email }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.results?.[0]?.code ?? null;
  } catch {
    return null;
  }
}

async function pollOtp(
  email: string,
  otpApi: string,
  otpToken: string,
  label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
  skipCode?: string,
): Promise<string | null> {
  await wait(5000);
  for (let i = 1; i <= 12; i++) {
    const otp = await fetchOtp(email, otpApi, otpToken);
    if (otp && otp !== skipCode) return otp;
    if (otp && otp === skipCode) {
      log(`OTP ${otp} đã dùng, đợi email mới...`, "warn");
    } else {
      log(`OTP chưa có (lần ${i}/12), đợi 5s...`);
    }
    await wait(5000);
  }
  return null;
}

async function findOtpField(page: any): Promise<any | null> {
  const selectors = [
    'input[autocomplete="one-time-code"]',
    'input[name*="otp"]',
    'input[id*="otp"]',
    'input[name*="code"]',
    'input[id*="code"]',
    'input[type="text"][maxlength="6"]',
    'input[type="tel"][maxlength="6"]',
    'input[type="text"]',
    'input[type="tel"]',
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    } catch {}
  }
  return null;
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function doLogin(
  page: any,
  email: string,
  password: string,
  label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<LoginOutcome> {
  const MAX_RETRIES = 5;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log(`Đợi 5s trước khi nhập... (lần ${attempt})`);
    await page.waitForTimeout(5000);

    const url = await page.url();
    if (isMfaUrl(url)) {
      log(`Đang ở trang MFA: ${url}`);
      return "mfa";
    }

    const emailField = page.locator('input[type="email"], input[name="email"], input[id*="mail"]').first();
    const passField  = page.locator('input[type="password"], input[name="password"]').first();
    const emailVisible = await emailField.isVisible({ timeout: 15000 }).catch(() => false);
    const passVisible  = await passField.isVisible({ timeout: 5000 }).catch(() => false);

    if (!emailVisible || !passVisible) {
      log(`Form login không hiện (lần ${attempt}/${MAX_RETRIES}) → reload...`, "warn");
      if (attempt === MAX_RETRIES) return "form_not_found";
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      continue;
    }

    await humanType(page, emailField, email);
    await page.waitForTimeout(rand(800, 1500));
    await humanType(page, passField, password);
    await page.waitForTimeout(rand(800, 1500));

    const loginBtn = page.locator('button[type="submit"], input[type="submit"]').first();
    await loginBtn.hover();
    await page.waitForTimeout(rand(300, 600));
    await loginBtn.click();
    await page.waitForTimeout(rand(3000, 5000));

    const afterUrl = await page.url();
    log(`URL sau login (lần ${attempt}): ${afterUrl}`);

    try {
      const wrongPw = page.locator('text="メールアドレスまたはパスワードが違います"');
      if (await wrongPw.count() > 0 && await wrongPw.isVisible()) return "wrong_password";
    } catch {}

    if (isMfaUrl(afterUrl)) return "mfa";
    if (!afterUrl.includes("/login")) return "success";

    if (attempt === MAX_RETRIES) {
      for (let w = 0; w < 8; w++) {
        await page.waitForTimeout(1000);
        const lateUrl = await page.url();
        if (isMfaUrl(lateUrl)) return "mfa";
        if (!lateUrl.includes("/login")) return "success";
      }
      return "captcha_fail";
    }

    log(`Captcha (lần ${attempt}/${MAX_RETRIES}) → reload...`, "warn");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  return "captcha_fail";
}

// ─── OTP Handler ──────────────────────────────────────────────────────────────

async function handleOtp(
  page: any,
  email: string,
  otpApi: string,
  otpToken: string,
  label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<"success" | "otp_not_found" | "field_not_found" | "invalid"> {
  const MAX_OTP_RETRY = 3;
  let lastOtp: string | undefined;

  for (let attempt = 1; attempt <= MAX_OTP_RETRY; attempt++) {
    log(`Đợi OTP mới (lần ${attempt}/${MAX_OTP_RETRY})...`);

    const otp = await pollOtp(email, otpApi, otpToken, label, log, lastOtp);
    if (!otp) return "otp_not_found";
    lastOtp = otp;
    log(`OTP nhận được: ${otp}`);

    let otpField = await findOtpField(page);
    if (!otpField) {
      await page.waitForTimeout(3000);
      otpField = await findOtpField(page);
    }
    if (!otpField) return "field_not_found";

    await otpField.click();
    try { await otpField.fill(""); } catch {}
    await page.waitForTimeout(rand(300, 600));
    await otpField.pressSequentially(otp, { delay: rand(80, 150) });
    await page.waitForTimeout(1500);

    const urlAfterType = await page.url();
    if (!isMfaUrl(urlAfterType)) { log("OTP tự submit thành công"); return "success"; }

    const authBtn = page.locator("a#authBtn");
    if (await authBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await authBtn.click();
    } else {
      const submitBtn = page.locator("button[type='submit'], input[type='submit']").first();
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitBtn.click();
      } else {
        await otpField.press("Enter");
      }
    }

    for (let w = 0; w < 10; w++) {
      await page.waitForTimeout(1000);
      const nowUrl = await page.url();
      if (!isMfaUrl(nowUrl)) { log(`Redirect sau OTP (${w + 1}s): ${nowUrl}`); break; }
    }

    try { await page.waitForLoadState("networkidle", { timeout: 15000 }); } catch {}
    await page.waitForTimeout(rand(1000, 2000));

    const finalUrl = await page.url();
    if (!isMfaUrl(finalUrl)) return "success";

    log(`OTP không hợp lệ, thử lại lần ${attempt + 1}...`, "warn");
  }

  return "invalid";
}

// ─── Order Status ─────────────────────────────────────────────────────────────

async function getOrderStatus(
  page: any,
  productCode: string,
  label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<{ success: boolean; step?: string; stepLabel?: string; error?: string }> {
  log("Đang vào trang lịch sử đơn hàng...");
  await page.evaluate((url: string) => { window.location.href = url; }, ORDER_URL);
  try { await page.waitForLoadState("networkidle", { timeout: 15000 }); } catch {}
  await page.waitForTimeout(1500);

  const orderUrl = await page.url();
  if (orderUrl.includes("/login")) {
    return { success: false, error: "Bị redirect về login khi vào trang đơn hàng" };
  }

  log(`Tìm sản phẩm: "${productCode}"`);
  const statusKeys = Object.keys(STATUS_MAP);

  const cardSelectors = [
    `li:has-text("${productCode}")`,
    `.order-item:has-text("${productCode}")`,
    `tr:has-text("${productCode}")`,
  ];

  for (const sel of cardSelectors) {
    try {
      const card = page.locator(sel).first();
      if (await card.count() === 0) continue;

      try {
        const finishLi = card.locator("ul.txtList li[class]");
        if (await finishLi.count() > 0) {
          const txt = await finishLi.last().innerText().catch(() => "");
          for (const jp of statusKeys) {
            if (txt.includes(jp)) return { success: true, ...STATUS_MAP[jp] };
          }
        }
      } catch {}

      try {
        const prog = card.locator("progress").first();
        if (await prog.count() > 0) {
          const val = Number(await prog.getAttribute("value").catch(() => "0"));
          const max = Number(await prog.getAttribute("max").catch(() => "100")) || 100;
          const idx = (val / max) > 0.66 ? 2 : (val / max) > 0.33 ? 1 : 0;
          return { success: true, ...STATUS_MAP[statusKeys[idx]] };
        }
      } catch {}

      const txt = await card.innerText().catch(() => "");
      for (let si = statusKeys.length - 1; si >= 0; si--) {
        if (txt.includes(statusKeys[si])) return { success: true, ...STATUS_MAP[statusKeys[si]] };
      }

      return { success: false, error: "Tìm thấy sản phẩm nhưng không xác định được trạng thái" };
    } catch {}
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (!bodyText.trim()) return { success: false, error: "Trang lịch sử trống hoặc chưa load xong" };

  if (bodyText.includes(productCode)) {
    for (let si = statusKeys.length - 1; si >= 0; si--) {
      if (bodyText.includes(statusKeys[si])) return { success: true, ...STATUS_MAP[statusKeys[si]] };
    }
    return { success: false, error: "Tìm thấy sản phẩm nhưng không xác định được trạng thái" };
  }

  return { success: false, error: `Mã "${productCode}" không có trong lịch sử đơn hàng` };
}

// ─── Parse Accounts ───────────────────────────────────────────────────────────

export function parseAccounts(accountList: string): AccountLine[] {
  return accountList
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 4) throw new Error(`Dòng ${index + 1}: sai định dạng. Cần ProxyId|Email|Password|ProductCode`);
      const proxyId = Number(parts[0]);
      if (isNaN(proxyId) || proxyId <= 0) throw new Error(`Dòng ${index + 1}: ProxyId không hợp lệ`);
      return { proxyId, email: parts[1], password: parts[2], productCode: parts[3] };
    });
}

// ─── Process One Account ──────────────────────────────────────────────────────

async function processAccount(params: {
  omni: any;
  account: AccountLine;
  otpUrl: string;
  otpKey: string;
  send: (event: SSEEvent) => void;
}): Promise<void> {
  const { omni, account, otpUrl, otpKey, send } = params;
  const { proxyId, email, password, productCode } = account;
  const label = email.split("@")[0];

  const log = (message: string, level?: "info" | "warn" | "error") => {
    send({ type: "log", label, message, level });
  };

  log(`Bắt đầu xử lý (proxy: ${proxyId})`);

  let profile: any;
  try {
    profile = await omni.profiles.create({
      name: `auto_${label}_${Date.now()}`,
      idProxy: proxyId,
      fingerprints: { operating_system: "window", browser_type: "edge", omni_browser_version: "78" },
    });
    log(`Tạo profile: ${profile.id}`);
  } catch (e: any) {
    send({ type: "result", label, success: false, error: `Không tạo được profile: ${e?.message}` });
    return;
  }

  const headless = process.env.POKEMON_HEADLESS === "true";
  const { session } = await omni.open(profile.id, { headless, scale: 0.9 });
  const page = session.page;

  try {
    await wait(3000);
    let gotoOk = false;
    for (let g = 1; g <= 3; g++) {
      try {
        await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        gotoOk = true;
        break;
      } catch (e: any) {
        log(`Tải trang login lần ${g}/3 lỗi`, "warn");
        if (g < 3) await wait(5000);
      }
    }
    if (!gotoOk) {
      send({ type: "result", label, success: false, error: "Không tải được trang login (proxy lỗi?)" });
      return;
    }

    const loginOutcome = await doLogin(page, email, password, label, log);
    log(`Kết quả đăng nhập: ${loginOutcome}`);

    if (loginOutcome === "wrong_password") {
      send({ type: "result", label, success: false, error: "Sai tài khoản hoặc mật khẩu" });
      return;
    }
    if (loginOutcome === "captcha_fail") {
      send({ type: "result", label, success: false, error: "Lỗi Captcha sau 5 lần thử" });
      return;
    }
    if (loginOutcome === "form_not_found") {
      send({ type: "result", label, success: false, error: "Form login không xuất hiện" });
      return;
    }

    if (loginOutcome === "mfa") {
      const otpOutcome = await handleOtp(page, email, otpUrl, otpKey, label, log);
      log(`Kết quả OTP: ${otpOutcome}`);
      if (otpOutcome !== "success") {
        const errMap: Record<string, string> = {
          otp_not_found:  "OTP không tìm thấy sau 60s",
          field_not_found: "Không tìm thấy ô nhập OTP",
          invalid:         "OTP không hợp lệ sau 3 lần thử",
        };
        send({ type: "result", label, success: false, error: errMap[otpOutcome] ?? otpOutcome });
        return;
      }
    }

    log(`Đăng nhập thành công, kiểm tra đơn hàng "${productCode}"...`);
    const status = await getOrderStatus(page, productCode, label, log);

    if (status.success) {
      log(`Kết quả: ${status.stepLabel}`);
      send({ type: "result", label, success: true, step: status.step, stepLabel: status.stepLabel });
    } else {
      send({ type: "result", label, success: false, error: status.error });
    }
  } finally {
    await wait(10000);
    try { await omni.close(profile.id); } catch {}
    try {
      await omni.profiles.delete(profile.id, true);
      log("Profile đã được xóa");
    } catch (e: any) {
      log(`Không xóa được profile: ${e?.message}`, "warn");
    }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  async function worker() {
    while (queue.length) {
      const item = queue.shift()!;
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export async function runOrderChecks(params: RunParams): Promise<void> {
  const { accounts, otpUrl, otpKey, omniHost, send } = params;

  const accountList = parseAccounts(accounts);
  const omni = new OmniLogin({ host: omniHost, timeout: 60000 });
  const concurrency = Math.max(1, Number(process.env.POKEMON_CONCURRENCY) || 2);

  await runWithConcurrency(accountList, concurrency, async (account) => {
    const label = account.email.split("@")[0];
    try {
      await processAccount({ omni, account, otpUrl, otpKey, send });
    } catch (err: any) {
      send({ type: "result", label, success: false, error: err?.message ?? String(err) });
    }
  });
}
