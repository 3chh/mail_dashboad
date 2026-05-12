import { OmniLogin } from "@omnilogin/sdk";

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
  threadProxies: number[]; // proxyId per thread slot (index = worker index)
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
  "注文受付済み": { step: "step1", stepLabel: "Bước 1" },
  "発送準備中":   { step: "step2", stepLabel: "Bước 2" },
  "発送済み":     { step: "step3", stepLabel: "Bước 3" },
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
    'input#authCode',
    'input[name="dwfrm_factor2Auth_authCode"]',
    'input[autocomplete="one-time-code"]',
    'input[type="text"][maxlength="6"]',
    'input[type="tel"][maxlength="6"]',
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) return el;
    } catch {}
  }
  return null;
}

// ─── Navigate to Login via Google Search ─────────────────────────────────────

async function navigateToLoginViaSearch(
  page: any,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<void> {
  // B1: Switch UI to Japanese
  log("B1: Đổi giao diện tiếng Nhật");
  await page.setExtraHTTPHeaders({ "accept-language": "ja-JP,ja;q=0.9,en;q=0.3" });

  // B2: Search on Google Japan
  log("B2: Tìm kiếm trên Google Nhật");
  await page.goto("https://www.google.co.jp", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

  const searchInput = page.locator('textarea[name="q"], input[name="q"]').first();
  await searchInput.waitFor({ state: "visible", timeout: 15000 });

  await page.mouse.move(200 + Math.random() * 300, 150 + Math.random() * 200, { steps: 10 });
  await page.waitForTimeout(rand(400, 800));
  await searchInput.click();
  await page.waitForTimeout(rand(300, 600));
  await searchInput.pressSequentially("ポケモンセンターオンライン ログイン", { delay: rand(100, 160) });
  await page.waitForTimeout(rand(900, 1600));
  await searchInput.press("Enter");

  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(rand(1200, 2000));

  // Scroll like reading results
  await page.mouse.wheel(0, rand(200, 400));
  await page.waitForTimeout(rand(600, 1200));

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
    const fallback = page.locator('a[href*="pokemoncenter-online.com/login"]').first();
    const visible = await fallback.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      const box = await fallback.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
        await page.waitForTimeout(rand(300, 600));
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await fallback.click();
      }
      navigated = true;
    }
  }

  if (!navigated) {
    log("Không tìm thấy link Pokemon Center, fallback goto trực tiếp", "warn");
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

  const landedUrl = await page.url();
  if (landedUrl.includes("reset-password") || !landedUrl.includes("pokemoncenter-online.com")) {
    log("Redirect bất thường, chuyển thẳng tới trang login", "warn");
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }

  // Fake reading / mouse movement on login page
  await page.waitForTimeout(rand(1500, 2800));
  await page.mouse.move(rand(300, 700), rand(200, 400), { steps: 12 });
  await page.waitForTimeout(rand(500, 1000));
  await page.mouse.wheel(0, rand(50, 150));
  await page.waitForTimeout(rand(400, 800));

  log(`B3 xong, URL: ${await page.url()}`);
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function doLogin(
  page: any,
  email: string,
  password: string,
  label: string,
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): Promise<LoginOutcome> {
  const MAX_RETRIES = 3;

  // Đợi form load xong hoàn toàn trước khi nhập
  const emailField = page.locator('input[type="email"], input[name="email"], input[id*="mail"]').first();
  const passField  = page.locator('input[type="password"], input[name="password"]').first();

  const emailVisible = await emailField.isVisible({ timeout: 20000 }).catch(() => false);
  const passVisible  = await passField.isVisible({ timeout: 10000 }).catch(() => false);
  if (!emailVisible || !passVisible) return "form_not_found";

  await emailField.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(rand(600, 1200));

  // B4: Nhập email + password 1 lần duy nhất
  log("B4: Nhập thông tin đăng nhập");
  const emailBox = await emailField.boundingBox().catch(() => null);
  if (emailBox) await page.mouse.move(emailBox.x + emailBox.width / 2, emailBox.y + emailBox.height / 2, { steps: 12 });
  await page.waitForTimeout(rand(500, 1000));
  await emailField.click();
  try { await emailField.fill(""); } catch {}
  await page.waitForTimeout(rand(400, 800));
  await emailField.pressSequentially(email, { delay: rand(150, 250) });
  await page.waitForTimeout(rand(1200, 2000));

  const passBox = await passField.boundingBox().catch(() => null);
  if (passBox) await page.mouse.move(passBox.x + passBox.width / 2, passBox.y + passBox.height / 2, { steps: 12 });
  await page.waitForTimeout(rand(500, 1000));
  await passField.click();
  try { await passField.fill(""); } catch {}
  await page.waitForTimeout(rand(400, 800));
  await passField.pressSequentially(password, { delay: rand(160, 260) });
  await page.waitForTimeout(rand(1200, 2000));

  // Lần đầu + tối đa 3 lần retry: chỉ bấm nút login lại
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const retryDelay = rand(5000, 10000);
      log(`Lỗi Captcha/403 → đợi ${retryDelay}ms rồi bấm login lại (lần ${attempt}/${MAX_RETRIES})`, "warn");
      await page.waitForTimeout(retryDelay);
    }

    const loginBtn = page.locator('button[type="submit"], input[type="submit"]').first();
    await loginBtn.hover();
    await page.waitForTimeout(rand(400, 800));
    await loginBtn.click();
    await page.waitForTimeout(rand(3000, 5000));

    const afterUrl = await page.url();
    log(`URL sau login${attempt > 0 ? ` (retry ${attempt})` : ""}: ${afterUrl}`);

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

  log(`Tìm sản phẩm mã: "${productCode}"`);

  // Find the order <li> containing the product image, then read li.finish inside ul.txtList
  const result: { found: boolean; statusText: string | null } = await page.evaluate((code: string) => {
    const img = document.querySelector(`img[src*="/img/item/${code}/"]`) as HTMLImageElement | null;
    if (!img) return { found: false, statusText: null };

    // Walk up to the enclosing order <li>
    let el: Element | null = img.parentElement;
    while (el && el.tagName !== "LI") {
      el = el.parentElement;
    }
    if (!el) return { found: true, statusText: null };

    // The current step = last li.finish inside ul.txtList
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

async function processAccount(params: {
  omni: any;
  account: AccountLine;
  proxyId: number;
  productCode: string;
  otpUrl: string;
  otpKey: string;
  send: (event: SSEEvent) => void;
}): Promise<void> {
  const { omni, account, proxyId, productCode, otpUrl, otpKey, send } = params;
  const { profileName, email, password } = account;
  const label = profileName;

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
    send({ type: "result", label, profileName, email, success: false, error: `Không tạo được profile: ${e?.message}` });
    return;
  }

  const headless = process.env.POKEMON_HEADLESS === "true";
  const { session } = await omni.open(profile.id, { headless, scale: 0.9 });
  const page = session.page;

  try {
    await wait(2000);
    try {
      await navigateToLoginViaSearch(page, log);
    } catch (e: any) {
      send({ type: "result", label, profileName, email, success: false, error: `Không vào được trang login: ${e?.message}` });
      return;
    }

    const loginOutcome = await doLogin(page, email, password, label, log);
    log(`Kết quả đăng nhập: ${loginOutcome}`);

    if (loginOutcome === "wrong_password") {
      send({ type: "result", label, profileName, email, success: false, error: "Sai tài khoản hoặc mật khẩu" });
      return;
    }
    if (loginOutcome === "captcha_fail") {
      send({ type: "result", label, profileName, email, success: false, error: "Lỗi Captcha sau 3 lần thử" });
      return;
    }
    if (loginOutcome === "form_not_found") {
      send({ type: "result", label, profileName, email, success: false, error: "Form login không xuất hiện" });
      return;
    }

    if (loginOutcome === "mfa") {
      const otpOutcome = await handleOtp(page, email, otpUrl, otpKey, label, log);
      log(`Kết quả OTP: ${otpOutcome}`);
      if (otpOutcome !== "success") {
        const errMap: Record<string, string> = {
          otp_not_found:   "OTP không tìm thấy sau 60s",
          field_not_found: "Không tìm thấy ô nhập OTP",
          invalid:         "OTP không hợp lệ sau 3 lần thử",
        };
        send({ type: "result", label, profileName, email, success: false, error: errMap[otpOutcome] ?? otpOutcome });
        return;
      }
    }

    log(`Đăng nhập thành công, kiểm tra đơn hàng "${productCode}"...`);
    const status = await getOrderStatus(page, productCode, label, log);

    if (status.success) {
      log(`Kết quả: ${status.stepLabel}`);
      send({ type: "result", label, profileName, email, success: true, step: status.step, stepLabel: status.stepLabel });
    } else {
      send({ type: "result", label, profileName, email, success: false, error: status.error });
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
  fn: (item: T, workerIdx: number) => Promise<void>,
): Promise<void> {
  const queue = items.map((item, i) => ({ item, originalIdx: i }));
  async function worker(workerIdx: number) {
    while (queue.length) {
      const entry = queue.shift();
      if (!entry) break;
      await fn(entry.item, workerIdx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, (_, i) => worker(i)));
}

export async function runOrderChecks(params: RunParams): Promise<void> {
  const { accounts, productCode, concurrency, threadProxies, otpUrl, otpKey, omniHost, send } = params;

  const accountList = parseAccounts(accounts);
  const omni = new OmniLogin({ host: omniHost, timeout: 60000 });

  await runWithConcurrency(accountList, concurrency, async (account, workerIdx) => {
    const proxyId = threadProxies[workerIdx];
    const label = account.profileName;
    try {
      await processAccount({ omni, account, proxyId, productCode, otpUrl, otpKey, send });
    } catch (err: any) {
      send({ type: "result", label, profileName: account.profileName, email: account.email, success: false, error: err?.message ?? String(err) });
    }
  });
}
