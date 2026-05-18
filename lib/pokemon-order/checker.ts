import puppeteer, { type Browser, type Page, type ElementHandle } from "puppeteer-core";
import { BitBrowserClient, refreshIp } from "@/lib/bitbrowser/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountLine = {
  profileName: string;
  email: string;
  password: string;
};

export type SSEEvent =
  | { type: "log"; label: string; message: string; level?: "info" | "warn" | "error" }
  | { type: "result"; label: string; profileName: string; email: string; success: boolean; step?: string; stepLabel?: string; error?: string }
  | { type: "done" };

export type RunParams = {
  accounts: string;
  productCode: string;
  concurrency: number;
  threadProfileIds: string[];
  otpUrl: string;
  otpKey: string;
  bitBrowserHost?: string;
  send: (event: SSEEvent) => void;
  signal?: AbortSignal;
};

type LoginOutcome = "success" | "mfa" | "wrong_password" | "timeout" | "form_not_found";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOGIN_URL = "https://www.pokemoncenter-online.com/login/";
const ORDER_URL = "https://www.pokemoncenter-online.com/order-history/";

export const STATUS_MAP: Record<string, { stepLabel: string; step: string }> = {
  "注文受付済み": { step: "step1", stepLabel: "Bước 1" },
  "発送準備中":   { step: "step2", stepLabel: "Bước 2" },
  "発送済み":     { step: "step3", stepLabel: "Bước 3" },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
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

// ─── Puppeteer helpers (bridge Playwright-style code) ────────────────────────

type AnyHandle = ElementHandle<Element>;

async function findVisible(page: Page, selector: string, timeoutMs: number): Promise<AnyHandle | null> {
  try {
    return (await page.waitForSelector(selector, { visible: true, timeout: timeoutMs })) as AnyHandle | null;
  } catch {
    return null;
  }
}

async function clearInput(handle: AnyHandle): Promise<void> {
  await handle.evaluate((el) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, ""); else input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function scrollIntoView(handle: AnyHandle): Promise<void> {
  await handle.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
}

async function waitTextVisible(page: Page, text: string, timeoutMs: number): Promise<void> {
  await page.waitForFunction(
    (t: string) => document.body && document.body.innerText.includes(t),
    { timeout: timeoutMs, polling: 500 },
    text,
  );
}

async function waitForUrl(page: Page, predicate: (url: string) => boolean, timeoutMs: number, intervalMs = 500): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate(page.url())) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("waitForUrl timeout");
}

async function waitNetworkIdle(page: Page, timeoutMs: number): Promise<void> {
  try { await page.waitForNetworkIdle({ timeout: timeoutMs, idleTime: 500 }); } catch {}
}

function isProxyError(err: any): boolean {
  const m = (err?.message ?? "") as string;
  return m.includes("ERR_SOCKS") || m.includes("ERR_PROXY") || m.includes("ERR_TUNNEL") || m.includes("ERR_CONNECTION_REFUSED");
}

// Goto với retry cho lỗi proxy tạm thời.
async function safeGoto(page: Page, url: string, timeoutMs: number, retries = 2): Promise<void> {
  let lastErr: any;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      return;
    } catch (e: any) {
      lastErr = e;
      if (isProxyError(e) && attempt <= retries) {
        await new Promise((r) => setTimeout(r, 3000 + attempt * 2000));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
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
  _label: string,
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

const OTP_SELECTORS = [
  'input#authCode',
  'input[name="dwfrm_factor2Auth_authCode"]',
  'input[autocomplete="one-time-code"]',
  'input[type="text"][maxlength="6"]',
  'input[type="tel"][maxlength="6"]',
];

async function findOtpField(page: Page): Promise<AnyHandle | null> {
  for (const sel of OTP_SELECTORS) {
    const el = await findVisible(page, sel, 1000);
    if (el) return el;
  }
  return null;
}

// ─── Navigate to Login via Google Search ─────────────────────────────────────

async function navigateToLoginViaSearch(
  page: Page,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<void> {
  // Ngôn ngữ tiếng Nhật đã được set sẵn trong profile BitBrowser → bỏ B1.

  // B2: Search on Google Japan
  log("B2: Tìm kiếm trên Google Nhật");
  await safeGoto(page, "https://www.google.co.jp", 60000);
  await waitNetworkIdle(page, 20000);

  // Google có thể show captcha ngay khi vào → extension cần thời gian giải.
  // Tìm ô search với timeout dài để chờ extension xử lý captcha xong.
  const searchInput = await findVisible(page, 'textarea[name="q"], input[name="q"]', 300000);
  if (!searchInput) throw new Error("Không tìm thấy ô tìm kiếm Google (captcha extension fail?)");

  await page.mouse.move(200 + Math.random() * 300, 150 + Math.random() * 200, { steps: 10 });
  await wait(rand(400, 800));
  await searchInput.click();
  await wait(rand(300, 600));
  await searchInput.type("ポケモンセンターオンライン ログイン", { delay: rand(100, 160) });
  await wait(rand(900, 1600));
  await searchInput.press("Enter");

  // Sau Enter cũng có thể bị captcha → đợi result link xuất hiện (extension giải nếu cần)
  log("Đợi kết quả Google (tối đa 5 phút cho captcha)...");
  const resultLink = await findVisible(page, 'a[href*="pokemoncenter-online.com/login"]', 300000);
  if (!resultLink) {
    log("Không tìm thấy link Pokemon Center trong kết quả", "warn");
  }
  await waitNetworkIdle(page, 10000);
  await wait(rand(1200, 2000));

  // Scroll like reading results
  await page.mouse.wheel({ deltaY: rand(200, 400) });
  await wait(rand(600, 1200));

  // B3: Click exact login link
  log("B3: Tìm và click link login");
  let navigated = false;

  try {
    navigated = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a")) as HTMLAnchorElement[];
      const target = links.find((a) => a.href && a.href.includes("pokemoncenter-online.com/login/"));
      if (target) { target.click(); return true; }
      return false;
    });
  } catch {}

  if (!navigated) {
    const fallback = await findVisible(page, 'a[href*="pokemoncenter-online.com/login"]', 5000);
    if (fallback) {
      const box = await fallback.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
        await wait(rand(300, 600));
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await fallback.click();
      }
      navigated = true;
    }
  }

  if (!navigated) {
    log("Không tìm thấy link Pokemon Center, fallback goto trực tiếp", "warn");
    await safeGoto(page, LOGIN_URL, 60000);
  } else {
    try { await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }); } catch {}
  }
  await waitNetworkIdle(page, 20000);

  const landedUrl = page.url();
  if (landedUrl.includes("reset-password") || !landedUrl.includes("pokemoncenter-online.com")) {
    log("Redirect bất thường, chuyển thẳng tới trang login", "warn");
    await safeGoto(page, LOGIN_URL, 60000);
    await waitNetworkIdle(page, 15000);
  }

  // Fake reading / mouse movement on login page
  await wait(rand(1500, 2800));
  await page.mouse.move(rand(300, 700), rand(200, 400), { steps: 12 });
  await wait(rand(500, 1000));
  await page.mouse.wheel({ deltaY: rand(50, 150) });
  await wait(rand(400, 800));

  log(`B3 xong, URL: ${page.url()}`);
}

// ─── Login ────────────────────────────────────────────────────────────────────

const WRONG_PW_TEXT = "メールアドレスまたはパスワードが違います";

async function doLogin(
  page: Page,
  email: string,
  password: string,
  _label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<LoginOutcome> {
  const emailSel = 'input[type="email"], input[name="email"], input[id*="mail"]';
  const passSel  = 'input[type="password"], input[name="password"]';

  async function humanIdle(): Promise<void> {
    // Mô phỏng người: di chuột random + scroll nhẹ + đợi
    const vp = page.viewport();
    const w = vp?.width ?? 800;
    const h = vp?.height ?? 600;
    const moves = rand(2, 4);
    for (let i = 0; i < moves; i++) {
      const x = rand(100, Math.max(101, w - 100));
      const y = rand(100, Math.max(101, h - 100));
      await page.mouse.move(x, y, { steps: rand(8, 16) }).catch(() => {});
      await wait(rand(300, 700));
    }
    // scroll nhẹ rồi cuộn lại
    await page.mouse.wheel({ deltaY: rand(80, 200) }).catch(() => {});
    await wait(rand(400, 800));
    await page.mouse.wheel({ deltaY: -rand(60, 150) }).catch(() => {});
    await wait(rand(400, 800));
  }

  async function typeCredentials(): Promise<boolean> {
    const e = await findVisible(page, emailSel, 20000);
    if (!e) return false;
    const p = await findVisible(page, passSel, 10000);
    if (!p) return false;

    await wait(rand(600, 1200));
    log("Nhập email/password (chậm, humanized)");
    const eBox = await e.boundingBox().catch(() => null);
    if (eBox) await page.mouse.move(eBox.x + eBox.width / 2, eBox.y + eBox.height / 2, { steps: rand(12, 20) });
    await wait(rand(500, 1000));
    await e.click();
    try { await clearInput(e); } catch {}
    await wait(rand(400, 800));
    await e.type(email, { delay: rand(200, 350) }); // chậm hơn
    await wait(rand(1500, 2500));

    const pBox = await p.boundingBox().catch(() => null);
    if (pBox) await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2, { steps: rand(12, 20) });
    await wait(rand(500, 1000));
    await p.click();
    try { await clearInput(p); } catch {}
    await wait(rand(400, 800));
    await p.type(password, { delay: rand(220, 360) }); // chậm hơn
    await wait(rand(1500, 2500));

    // Idle "xem lại form" trước khi click login
    log("Idle 3-8s + mouse moves random (humanization)");
    await humanIdle();
    await wait(rand(3000, 8000));
    return true;
  }

  // B4: Nhập email + password lần đầu
  log("B4: Nhập thông tin đăng nhập");
  if (!(await typeCredentials())) return "form_not_found";

  // Captcha login: KHÔNG có extension giải. Chỉ click + wait + retry.
  // 4 click total (1 đầu + 3 retry). Trước click CUỐI: reload page + retype creds
  // để fresh captcha session.
  const MAX_LOGIN_RETRIES = 3;
  const WAIT_AFTER_CLICK_MS = 60000;
  const loginSelector = 'button[type="submit"], input[type="submit"]';

  async function clickLoginBtn(): Promise<boolean> {
    // 1. Position-based click (ưu tiên)
    try {
      const loginEl = await findVisible(page, loginSelector, 5000);
      if (loginEl) {
        await scrollIntoView(loginEl).catch(() => {});
        await wait(rand(300, 600));
        const box = await loginEl.boundingBox().catch(() => null);
        const vp = page.viewport();
        const inViewport = box && box.y >= 0 && box.x >= 0
          && (!vp || (box.y + box.height <= vp.height && box.x + box.width <= vp.width));
        if (box && inViewport) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
          await wait(rand(300, 600));
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          return true;
        }
      }
    } catch {}

    // 2. ElementHandle click
    try {
      const el = await page.$(loginSelector);
      if (el) { await el.click(); return true; }
    } catch {}

    // 3. JS evaluate
    try {
      return await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement | null;
        if (btn) { btn.click(); return true; }
        return false;
      });
    } catch {}

    return false;
  }

  for (let attempt = 0; attempt <= MAX_LOGIN_RETRIES; attempt++) {
    if (attempt > 0) {
      if (attempt === MAX_LOGIN_RETRIES) {
        // Click cuối: reload page + retype creds để fresh captcha session
        log(`${attempt} click trước fail → reload page + gõ lại creds rồi click lần cuối ${attempt + 1}/${MAX_LOGIN_RETRIES + 1}`, "warn");
        try {
          await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        } catch (e: any) {
          log(`Reload lỗi (${e?.message}) → goto LOGIN_URL`, "warn");
          await safeGoto(page, LOGIN_URL, 60000).catch(() => {});
        }
        await waitNetworkIdle(page, 15000);
        await wait(rand(1500, 2500));
        if (!(await typeCredentials())) {
          log("Sau reload không tìm thấy form login → fail", "warn");
          return "form_not_found";
        }
      } else {
        const retryDelay = rand(10000, 15000);
        log(`Captcha/page chưa qua → đợi ${retryDelay}ms rồi click login lại (lần ${attempt + 1}/${MAX_LOGIN_RETRIES + 1})`, "warn");
        await wait(retryDelay);
      }
    }

    const clicked = await clickLoginBtn();
    if (!clicked) log("Không click được nút login", "warn");

    log(`Click ${attempt + 1}/${MAX_LOGIN_RETRIES + 1}: chờ tối đa ${WAIT_AFTER_CLICK_MS / 1000}s cho URL chuyển...`);
    const t0 = Date.now();
    let wrongPassword = false;
    try {
      await Promise.race([
        waitForUrl(page, (s) => !s.includes("/login") || isMfaUrl(s), WAIT_AFTER_CLICK_MS),
        waitTextVisible(page, WRONG_PW_TEXT, WAIT_AFTER_CLICK_MS).then(() => { wrongPassword = true; }),
      ]);
      log(`URL đổi sau ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch {
      log(`Timeout ${WAIT_AFTER_CLICK_MS / 1000}s — captcha chưa giải xong, sẽ click lại`, "warn");
    }

    if (wrongPassword) return "wrong_password";

    const afterUrl = page.url();
    if (isMfaUrl(afterUrl)) return "mfa";
    if (!afterUrl.includes("/login")) { log(`URL sau login: ${afterUrl}`); return "success"; }

    // Vẫn ở /login → captcha chưa giải / lỗi tạm → retry click
    if (attempt === MAX_LOGIN_RETRIES) {
      // Lần cuối: cho thêm 10s grace
      for (let w = 0; w < 10; w++) {
        await wait(1000);
        const u = page.url();
        if (isMfaUrl(u)) return "mfa";
        if (!u.includes("/login")) { log(`URL sau login (delayed): ${u}`); return "success"; }
      }
    }
  }

  return "timeout";
}

// ─── OTP Handler ──────────────────────────────────────────────────────────────

// Nhập OTP vào field + click authBtn + đợi redirect khỏi MFA
// Trả về:
//   - "redirected": URL chuyển sang trang hợp lệ
//   - "error_page": URL chuyển sang /error/ (session corrupt, không nên retry)
//   - "no_field": không tìm thấy field OTP
//   - "timeout": hết thời gian, URL vẫn ở MFA
async function submitOtpOnce(
  page: Page,
  otp: string,
  waitMs: number,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<"redirected" | "error_page" | "no_field" | "timeout"> {
  let otpField = await findOtpField(page);
  if (!otpField) {
    await wait(3000);
    otpField = await findOtpField(page);
  }
  if (!otpField) return "no_field";

  await otpField.click();
  try { await clearInput(otpField); } catch {}
  await wait(rand(300, 600));
  await otpField.type(otp, { delay: rand(250, 400) });
  await wait(rand(800, 1200));

  // Force trigger input/change events qua React-style setter + blur
  await page.evaluate((code: string) => {
    const sel = 'input#authCode, input[name="dwfrm_factor2Auth_authCode"], input[autocomplete="one-time-code"], input[type="text"][maxlength="6"], input[type="tel"][maxlength="6"]';
    const field = document.querySelector(sel) as HTMLInputElement | null;
    if (!field) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(field, code); else field.value = code;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.blur();
  }, otp).catch(() => {});

  await page.keyboard.press("Tab").catch(() => {});
  await wait(rand(800, 1500));

  if (!isMfaUrl(page.url())) { log("OTP tự submit thành công"); return "redirected"; }

  // Click authBtn (3-tier)
  let clicked = false;
  try {
    const authEl = await findVisible(page, "a#authBtn", 3000);
    if (authEl) {
      await scrollIntoView(authEl).catch(() => {});
      await wait(rand(200, 500));
      const box = await authEl.boundingBox().catch(() => null);
      const vp = page.viewport();
      const inViewport = box && box.y >= 0 && box.x >= 0
        && (!vp || (box.y + box.height <= vp.height && box.x + box.width <= vp.width));
      if (box && inViewport) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
        await wait(rand(200, 500));
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        clicked = true;
      }
    }
  } catch {}
  if (!clicked) {
    try {
      const el = await page.$("a#authBtn");
      if (el) { await el.click(); clicked = true; }
    } catch {}
  }
  if (!clicked) {
    try {
      clicked = await page.evaluate(() => {
        const btn = document.querySelector("#authBtn") as HTMLElement | null;
        if (btn) { btn.click(); return true; }
        return false;
      });
    } catch {}
  }
  if (!clicked) log("Không click được nút xác thực OTP", "warn");

  const t0 = Date.now();
  try {
    await waitForUrl(page, (s) => !isMfaUrl(s), waitMs);
    const u = page.url();
    log(`Redirect sau ${((Date.now() - t0) / 1000).toFixed(1)}s → ${u}`);
    if (u.includes("/error")) return "error_page";
    return "redirected";
  } catch {
    return "timeout";
  }
}

type OtpResult = {
  outcome: "success" | "otp_not_found" | "field_not_found" | "invalid";
  otpUsed?: string;
};

async function handleOtp(
  page: Page,
  email: string,
  otpApi: string,
  otpToken: string,
  label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
  skipCode?: string,
): Promise<OtpResult> {
  // Sanity check: nếu page đã out MFA rồi (server skip MFA hoặc redirect nhanh
  // hơn doLogin kịp detect) → không cần handle OTP nữa.
  const curUrl = page.url();
  if (!isMfaUrl(curUrl) && !curUrl.includes("/login")) {
    log(`Page đã out MFA (${curUrl}) — bỏ qua handle OTP`);
    return { outcome: "success" };
  }

  log(`Đợi OTP từ email${skipCode ? ` (bỏ qua mã ${skipCode})` : ""}...`);
  const otp = await pollOtp(email, otpApi, otpToken, label, log, skipCode);
  if (!otp) return { outcome: "otp_not_found" };
  log(`OTP nhận được: ${otp}`);

  // 3 lần: lần 1 nhập trực tiếp, lần 2 và 3 refresh + nhập lại; mỗi lần chờ 90s
  const MAX_ATTEMPTS = 3;
  const WAIT_PER_ATTEMPT_MS = 90000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      // Refresh page rồi nhập lại OTP cũ
      log(`Lần ${attempt}/${MAX_ATTEMPTS}: refresh page rồi nhập lại OTP`, "warn");
      try {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      } catch (e: any) {
        log(`page.reload lỗi (${e?.message}) → fallback JS location.reload`, "warn");
        try {
          await page.evaluate(() => { window.location.reload(); });
          await wait(3000);
        } catch {}
      }
      await waitNetworkIdle(page, 15000);
      await wait(rand(1500, 2500));

      const u = page.url();
      if (!isMfaUrl(u) && !u.includes("/error")) {
        log(`Reload xong đã out MFA: ${u}`);
        return { outcome: "success", otpUsed: otp };
      }
      if (u.includes("/error")) {
        log(`Reload xong vào /error/ — session corrupt`, "warn");
        return { outcome: "invalid", otpUsed: otp };
      }
    } else {
      log(`Lần ${attempt}/${MAX_ATTEMPTS}: nhập OTP, đợi redirect (tối đa ${WAIT_PER_ATTEMPT_MS / 1000}s)...`);
    }

    const r = await submitOtpOnce(page, otp, WAIT_PER_ATTEMPT_MS, log);
    if (r === "no_field") return { outcome: "field_not_found", otpUsed: otp };
    if (r === "error_page") {
      log("Submit OTP redirect sang /error/ — session corrupt", "warn");
      return { outcome: "invalid", otpUsed: otp };
    }
    if (r === "redirected" && !isMfaUrl(page.url()) && !page.url().includes("/error")) {
      log(`URL sau OTP: ${page.url()}`);
      return { outcome: "success", otpUsed: otp };
    }
  }

  log(`Đã thử ${MAX_ATTEMPTS} lần (1 nhập + ${MAX_ATTEMPTS - 1} refresh) vẫn không qua MFA`, "warn");
  return { outcome: "invalid", otpUsed: otp };
}

// ─── Order Status ─────────────────────────────────────────────────────────────

async function getOrderStatus(
  page: Page,
  productCode: string,
  _label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<{ success: boolean; step?: string; stepLabel?: string; error?: string }> {
  log("Đang vào trang lịch sử đơn hàng...");
  await page.evaluate((url: string) => { window.location.href = url; }, ORDER_URL);
  await waitNetworkIdle(page, 15000);
  await wait(1500);

  const orderUrl = page.url();
  if (orderUrl.includes("/login")) {
    return { success: false, error: "Bị redirect về login khi vào trang đơn hàng" };
  }

  log(`Tìm sản phẩm mã: "${productCode}"`);

  const result: { found: boolean; statusText: string | null } = await page.evaluate((code: string) => {
    const img = document.querySelector(`img[src*="/img/item/${code}/"]`) as HTMLImageElement | null;
    if (!img) return { found: false, statusText: null };

    let el: Element | null = img.parentElement;
    while (el && el.tagName !== "LI") {
      el = el.parentElement;
    }
    if (!el) return { found: true, statusText: null };

    const finishEls = el.querySelectorAll("ul.txtList li.finish");
    if (finishEls.length > 0) {
      const last = finishEls[finishEls.length - 1] as HTMLElement;
      return { found: true, statusText: last.innerText.trim() };
    }

    return { found: true, statusText: null };
  }, productCode);

  if (!result.found) {
    return { success: true, step: "not_found", stepLabel: "Không có đơn" };
  }
  if (!result.statusText) {
    return { success: false, error: "Tìm thấy sản phẩm nhưng không xác định được trạng thái" };
  }

  const matched = STATUS_MAP[result.statusText];
  if (matched) return { success: true, ...matched };

  return { success: false, error: `Trạng thái không nhận dạng được: "${result.statusText}"` };
}

// ─── Parse Accounts ───────────────────────────────────────────────────────────

export function parseAccounts(accountList: string): AccountLine[] {
  return accountList
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 3) throw new Error(`Dòng ${index + 1}: sai định dạng. Cần ProfileName|Email|Password`);
      return { profileName: parts[0], email: parts[1], password: parts[2] };
    });
}

// ─── Process One Account ──────────────────────────────────────────────────────

type ProcessAccountStatus = "done" | "captcha_retry";

async function processAccount(params: {
  bb: BitBrowserClient;
  profileId: string;
  account: AccountLine;
  productCode: string;
  otpUrl: string;
  otpKey: string;
  send: (event: SSEEvent) => void;
  signal?: AbortSignal;
  isLastPass: boolean; // pass cuối — captcha fail vẫn send result, không re-queue
}): Promise<ProcessAccountStatus> {
  const { bb, profileId, account, productCode, otpUrl, otpKey, send, signal, isLastPass } = params;
  const { profileName, email, password } = account;
  const label = profileName;

  const log = (message: string, level?: "info" | "warn" | "error") => {
    send({ type: "log", label, message, level });
  };

  // Khi captcha fail mà chưa phải pass cuối → defer (không send result, sẽ retry sau).
  const sendCaptchaFail = (errMsg: string): ProcessAccountStatus => {
    if (isLastPass) {
      send({ type: "result", label, profileName, email, success: false, error: errMsg });
      return "done";
    }
    log(`${errMsg} → defer, sẽ retry ở pass sau`, "warn");
    return "captcha_retry";
  };

  log(`Bắt đầu xử lý (profile: ${profileId})`);
  checkAbort(signal);

  // B0: Clear cache (giữ extension data) + random fingerprint
  try {
    log("B0a: Clear cache (giữ extension data)...");
    await bb.clearCacheKeepExtensions(profileId);
  } catch (e: any) {
    log(`Clear cache lỗi: ${e?.message} (vẫn tiếp tục)`, "warn");
  }
  try {
    log("B0b: Random fingerprint...");
    await bb.randomFingerprint(profileId);
  } catch (e: any) {
    log(`Random fingerprint lỗi: ${e?.message} (vẫn tiếp tục)`, "warn");
  }

  // B0c: gọi link xoay IP. Ưu tiên đọc từ profile detail; nếu không có, dùng
  // POKEMON_REFRESH_URL env hoặc URL tạm cứng (provider hiện tại của user).
  const FALLBACK_REFRESH_URL = process.env.POKEMON_REFRESH_URL
    ?? "https://i.fxdx.in/actionlinks/do/changeip/9e4pySLjRH6s9rYThjPaog";
  try {
    let refreshUrl: string | null = null;
    try {
      const detail = await bb.getProfileDetail(profileId);
      refreshUrl = bb.extractRefreshUrl(detail);
    } catch (e: any) {
      log(`Lấy profile detail lỗi: ${e?.message} → dùng URL fallback`, "warn");
    }
    if (!refreshUrl) refreshUrl = FALLBACK_REFRESH_URL;

    log(`B0c: Xoay IP qua refresh URL (${refreshUrl.slice(0, 60)}...)`);
    const r = await refreshIp(refreshUrl);
    if (r.ok) log(`Xoay IP OK: ${r.body ?? "no body"}`);
    else log(`Xoay IP lỗi: ${r.error} (vẫn tiếp tục)`, "warn");
    // Đợi 1-2s cho proxy server áp dụng IP mới
    await wait(rand(1500, 2500), signal);
  } catch (e: any) {
    log(`Xoay IP exception: ${e?.message} (vẫn tiếp tục)`, "warn");
  }

  let browser: Browser | null = null;

  try {
    checkAbort(signal);

    let openInfo: { ws: string; http: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      checkAbort(signal);
      try {
        openInfo = await bb.openBrowser(profileId);
        break;
      } catch (e: any) {
        if ((e as DOMException).name === "AbortError") throw e;
        if (attempt === 3) throw e;
        log(`Mở browser lỗi (lần ${attempt}/3): ${e?.message} → đợi 15s...`, "warn");
        await wait(15000, signal);
      }
    }
    if (!openInfo) throw new Error("Không mở được browser");

    log(`BitBrowser open OK, CDP: ${openInfo.ws} | HTTP: ${openInfo.http}`);
    log("Connecting puppeteer...");
    browser = await puppeteer.connect({
      browserWSEndpoint: openInfo.ws,
      defaultViewport: null,
      protocolTimeout: 300000, // 5 phút (some evaluate calls trên page render chậm có thể vượt 2 phút)
    });
    log("Puppeteer connected, đợi page target...");

    // Poll targets()/pages() đợi tab có sẵn của BitBrowser. KHÔNG gọi newPage()
    // (Page.enable cho tab mới bị treo trong BitBrowser core).
    let page: Page | null = null;
    const waitStart = Date.now();
    let iter = 0;
    while (Date.now() - waitStart < 20000) {
      iter++;
      const pages = await browser.pages().catch(() => [] as Page[]);
      const targets = browser.targets();

      // Log tình trạng mỗi 2s (~4 iter)
      if (iter === 1 || iter % 4 === 0) {
        const types = targets.map((t) => {
          const u = (t.url?.() ?? "") as string;
          return `${t.type?.() ?? "?"}:${u.slice(0, 40)}`;
        }).join(", ");
        log(`Iter ${iter}: pages=${pages.length}, targets=${targets.length} [${types}]`);
      }

      if (pages.length > 0) { page = pages[0]; break; }

      for (const t of targets) {
        const type = t.type?.();
        if (type === "page" || type === "webview" || type === "other" || type === "browser") {
          try {
            const p = await t.page();
            if (p) { page = p; break; }
          } catch {}
        }
      }
      if (page) break;
      await wait(500);
    }
    if (!page) {
      // Diagnose: gọi trực tiếp DevTools HTTP API xem BitBrowser expose tab gì
      const baseHttp = openInfo.http.startsWith("http") ? openInfo.http : `http://${openInfo.http}`;
      try {
        const r = await fetch(`${baseHttp}/json/list`);
        const list = await r.json();
        log(`/json/list trả về ${list.length} entry: ${JSON.stringify(list.map((x: any) => ({ type: x.type, url: x.url?.slice(0, 60), title: x.title?.slice(0, 30) }))).slice(0, 500)}`);
      } catch (e: any) {
        log(`/json/list lỗi: ${e?.message}`, "warn");
      }
      throw new Error("Không tìm được page target nào trong 20s");
    }
    log(`Đã chọn page: ${page.url()}`);

    // Set viewport = Samsung Galaxy S20 Ultra (mobile emulation)
    // Giữ nguyên UA của profile, chỉ đổi viewport/touch để page render mobile.
    try {
      await page.setViewport({
        width: 412,
        height: 915,
        deviceScaleFactor: 3.5,
        isMobile: true,
        hasTouch: true,
        isLandscape: false,
      });
      log("Đã set viewport = Samsung Galaxy S20 Ultra (412x915, DPR 3.5, mobile+touch)");
    } catch (e: any) {
      log(`Set viewport lỗi: ${e?.message} (vẫn tiếp tục)`, "warn");
    }

    // B0d: check public IP qua proxy (verify xoay IP thật sự work + show exit IP)
    try {
      await page.goto("https://api.ipify.org/?format=json", { waitUntil: "domcontentloaded", timeout: 20000 });
      const ipBody = await page.evaluate(() => document.body.innerText.trim().slice(0, 200));
      const ipMatch = ipBody.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
      if (ipMatch) {
        log(`✓ Public IP qua proxy: ${ipMatch[0]} (raw: ${ipBody.slice(0, 80)})`);
      } else {
        log(`Check IP: không parse được IP từ response: ${ipBody.slice(0, 100)}`, "warn");
      }
    } catch (e: any) {
      log(`Check public IP lỗi: ${e?.message} (proxy có thể không hoạt động)`, "warn");
    }

    await wait(2000, signal);
    checkAbort(signal);

    try {
      await navigateToLoginViaSearch(page, log);
    } catch (e: any) {
      if ((e as DOMException).name === "AbortError") throw e;
      log(`Search flow lỗi: ${e?.message} → fallback goto trực tiếp`, "warn");
      try {
        await safeGoto(page, LOGIN_URL, 60000);
        await waitNetworkIdle(page, 20000);
        await wait(rand(1500, 2500));
      } catch (e2: any) {
        const reason = isProxyError(e2)
          ? `Proxy SOCKS5 lỗi (${e2?.message?.split(" at ")[0]}) — kiểm tra proxy của profile hoặc đợi rồi thử lại`
          : `Không vào được trang login: ${e2?.message}`;
        send({ type: "result", label, profileName, email, success: false, error: reason });
        return "done";
      }
    }

    // Login + OTP có 2 vòng: nếu OTP fail sau khi đã refresh+retry trong handleOtp
    // → quay lại trang login, đăng nhập lại từ đầu (lấy OTP mới)
    const MAX_LOGIN_ROUNDS = 2;
    let lastOtp: string | undefined;
    let finalLoginOutcome: LoginOutcome | null = null;
    let otpFinalResult: OtpResult | null = null;

    for (let round = 1; round <= MAX_LOGIN_ROUNDS; round++) {
      checkAbort(signal);
      if (round > 1) {
        log(`[Vòng ${round}/${MAX_LOGIN_ROUNDS}] OTP fail → quay lại login, đăng nhập lại`, "warn");
        try {
          await safeGoto(page, LOGIN_URL, 60000);
          await waitNetworkIdle(page, 15000);
          await wait(rand(1500, 2500));
        } catch (e: any) {
          send({ type: "result", label, profileName, email, success: false, error: `Re-login goto lỗi: ${e?.message}` });
          return "done";
        }
      }

      checkAbort(signal);
      const loginOutcome = await doLogin(page, email, password, label, log);
      log(`Kết quả đăng nhập [vòng ${round}]: ${loginOutcome}`);
      finalLoginOutcome = loginOutcome;

      // Lỗi hard không retry
      if (loginOutcome === "wrong_password") {
        send({ type: "result", label, profileName, email, success: false, error: "Sai tài khoản hoặc mật khẩu" });
        return "done";
      }
      if (loginOutcome === "form_not_found") {
        send({ type: "result", label, profileName, email, success: false, error: "Form login không xuất hiện" });
        return "done";
      }
      if (loginOutcome === "timeout") {
        // Captcha login timeout → có thể requeue ở pass sau (defer nếu chưa lastPass)
        return sendCaptchaFail("Captcha không qua sau 4 lần click + đợi (~60s/lần). Có thể IP bị block.");
      }

      if (loginOutcome === "success") break; // không cần MFA

      if (loginOutcome === "mfa") {
        otpFinalResult = await handleOtp(page, email, otpUrl, otpKey, label, log, lastOtp);
        log(`Kết quả OTP [vòng ${round}]: ${otpFinalResult.outcome}`);
        if (otpFinalResult.otpUsed) lastOtp = otpFinalResult.otpUsed;
        if (otpFinalResult.outcome === "success") break;

        // Lỗi hard không re-login
        if (otpFinalResult.outcome === "otp_not_found" || otpFinalResult.outcome === "field_not_found") {
          break;
        }
        // outcome === "invalid" → re-login ở vòng kế (nếu còn)
      }
    }

    // Sau loop: nếu chưa thành công, send fail
    const lastOtpOutcome = otpFinalResult?.outcome;
    if (finalLoginOutcome !== "success" && lastOtpOutcome !== "success") {
      const errMap: Record<string, string> = {
        otp_not_found:   "OTP không tìm thấy sau 60s",
        field_not_found: "Không tìm thấy ô nhập OTP",
        invalid:         `OTP fail sau ${MAX_LOGIN_ROUNDS} vòng (refresh + re-login)`,
      };
      const errMsg = lastOtpOutcome ? (errMap[lastOtpOutcome] ?? lastOtpOutcome) : `Login outcome bất thường: ${finalLoginOutcome}`;
      send({ type: "result", label, profileName, email, success: false, error: errMsg });
      return "done";
    }

    checkAbort(signal);
    log(`Đăng nhập thành công, kiểm tra đơn hàng "${productCode}"...`);
    const status = await getOrderStatus(page, productCode, label, log);

    if (status.success) {
      log(`Kết quả: ${status.stepLabel}`);
      send({ type: "result", label, profileName, email, success: true, step: status.step, stepLabel: status.stepLabel });
    } else {
      send({ type: "result", label, profileName, email, success: false, error: status.error });
    }
    return "done";
  } catch (e: any) {
    if ((e as DOMException).name === "AbortError") {
      log("Đã dừng", "warn");
      return "done";
    }
    throw e;
  } finally {
    await wait(2000);
    try { await browser?.disconnect(); } catch {}
    try {
      await bb.closeBrowser(profileId);
      log("Browser đã đóng (profile giữ nguyên)");
    } catch (e: any) {
      log(`Đóng browser lỗi: ${e?.message}`, "warn");
    }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  signal: AbortSignal | undefined,
  fn: (item: T, workerIdx: number) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  async function worker(workerIdx: number) {
    while (queue.length) {
      if (signal?.aborted) break;
      const item = queue.shift();
      if (!item) break;
      await fn(item, workerIdx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, (_, i) => worker(i)));
}

export async function runOrderChecks(params: RunParams): Promise<void> {
  const { accounts, productCode, concurrency, threadProfileIds, otpUrl, otpKey, bitBrowserHost, send, signal } = params;

  const accountList = parseAccounts(accounts);
  const bb = new BitBrowserClient(bitBrowserHost);

  // 2 pass: pass 1 chạy tất cả, account fail captcha sẽ defer → pass 2 retry
  const MAX_PASSES = 2;
  let queue = [...accountList];

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    if (queue.length === 0) break;
    if (pass > 1) {
      send({ type: "log", label: "system", message: `=== Pass ${pass}/${MAX_PASSES}: retry ${queue.length} account fail captcha ===` });
      // Đợi một chút để các IP "rã" rate-limit
      await wait(10000, signal).catch(() => {});
    }

    const isLastPass = pass === MAX_PASSES;
    const deferQueue: AccountLine[] = [];

    await runWithConcurrency(queue, concurrency, signal, async (account, workerIdx) => {
      if (signal?.aborted) return;
      const profileId = threadProfileIds[workerIdx];
      const label = account.profileName;
      try {
        const status = await processAccount({
          bb, profileId, account, productCode, otpUrl, otpKey, send, signal, isLastPass,
        });
        if (status === "captcha_retry") {
          deferQueue.push(account);
        }
      } catch (err: any) {
        if ((err as DOMException).name === "AbortError") return;
        const msg = (err?.message ?? String(err)) as string;
        // Runtime timeout = page bị poison (vd captcha Google stuck) → fresh browser pass sau
        const isRuntimeTimeout = msg.includes("Runtime.callFunctionOn timed out") || msg.includes("protocolTimeout");
        if (isRuntimeTimeout && !isLastPass) {
          send({ type: "log", label, message: `Runtime timeout (${msg.slice(0, 80)}) → defer pass sau`, level: "warn" });
          deferQueue.push(account);
        } else {
          send({ type: "result", label, profileName: account.profileName, email: account.email, success: false, error: msg });
        }
      }
    });

    queue = deferQueue;
  }
}
