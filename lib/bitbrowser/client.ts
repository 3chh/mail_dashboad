// BitBrowser local API client.
// Docs: https://doc.bitbrowser.net/api-docs

export type BitBrowserGroup = {
  id: string;
  groupName: string;
};

export type BitBrowserProfile = {
  id: string;
  name: string;
  seq?: number;
  groupId?: string;
  remark?: string;
};

export type OpenedBrowser = {
  ws: string;
  http: string;
  pid?: number;
  coreVersion?: string;
};

export class BitBrowserClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? process.env.BITBROWSER_HOST ?? "http://127.0.0.1:54345").replace(/\/+$/, "");
  }

  private async post<T = any>(path: string, body: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`BitBrowser ${path}: response không phải JSON: ${text.slice(0, 200)}`); }
    if (!json.success) {
      throw new Error(`BitBrowser ${path} lỗi: ${json.msg ?? json.message ?? JSON.stringify(json)}`);
    }
    return json.data as T;
  }

  // ─── Group ──────────────────────────────────────────────────────────────────

  async listGroups(): Promise<BitBrowserGroup[]> {
    const data = await this.post<{ list?: BitBrowserGroup[] }>("/group/list", {
      page: 0,
      pageSize: 100,
      all: true,
    });
    return data?.list ?? [];
  }

  // ─── Profile ────────────────────────────────────────────────────────────────

  async listProfiles(groupId: string, pageSize = 200): Promise<BitBrowserProfile[]> {
    const data = await this.post<{ list?: BitBrowserProfile[] }>("/browser/list", {
      page: 0,
      pageSize,
      groupId,
      sort: "desc",
    });
    return data?.list ?? [];
  }

  // Clear cache nhưng GIỮ data của extension (key license, config của extension giải captcha...)
  async clearCacheKeepExtensions(profileId: string): Promise<void> {
    await this.post("/cache/clear/exceptExtensions", { ids: [profileId] });
  }

  // Random lại fingerprint mà không động vào các field khác
  async randomFingerprint(profileId: string): Promise<void> {
    await this.post("/browser/fingerprint/random", { browserId: profileId });
  }

  // Lấy full config profile, bao gồm proxy + "Làm mới URL" (dynamicIpUrl)
  async getProfileDetail(profileId: string): Promise<any> {
    return await this.post("/browser/detail", { id: profileId });
  }

  // Trích "Làm mới URL" / dynamicIpUrl từ profile detail. Quét nhiều tên field
  // khả dĩ vì BitBrowser API trả khác nhau giữa các phiên bản.
  extractRefreshUrl(detail: any): string | null {
    if (!detail || typeof detail !== "object") return null;
    const candidates = [
      detail.dynamicIpUrl,
      detail.changeIpUrl,
      detail.refreshUrl,
      detail.proxyChangeIpUrl,
      detail.proxy?.dynamicIpUrl,
      detail.proxy?.changeIpUrl,
      detail.proxy?.refreshUrl,
      detail.proxyData?.dynamicIpUrl,
      detail.proxyData?.changeIpUrl,
    ];
    for (const u of candidates) {
      if (typeof u === "string" && /^https?:\/\//i.test(u.trim())) return u.trim();
    }
    return null;
  }

  // ─── Browser open/close ─────────────────────────────────────────────────────

  // KHÔNG dùng --headless: extension giải captcha không load đúng trong headless mode,
  // và CDP enumerate page bị treo. BitBrowser sẽ hiện cửa sổ; nếu muốn ẩn,
  // dùng workspace setting trong BitBrowser app thay vì flag.
  async openBrowser(id: string): Promise<OpenedBrowser> {
    return await this.post<OpenedBrowser>("/browser/open", { id });
  }

  async closeBrowser(id: string): Promise<void> {
    await this.post("/browser/close", { id });
  }
}

// ─── Refresh IP (gọi link "Làm mới URL") ─────────────────────────────────────

// Serialize per-URL: nhiều worker dùng cùng provider sẽ bị 429.
const refreshQueue = new Map<string, Promise<unknown>>();
const MIN_GAP_MS = 1500;

async function callRefresh(url: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; body?: string; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const body = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}: ${body.slice(0, 120)}` };
    return { ok: true, body: body.trim().slice(0, 200) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshIp(
  refreshUrl: string,
  opts?: { timeoutMs?: number; maxRetries?: number },
): Promise<{ ok: boolean; body?: string; error?: string }> {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const maxRetries = opts?.maxRetries ?? 4;

  // Xếp hàng theo URL để tránh spam provider gây 429
  const prev = refreshQueue.get(refreshUrl) ?? Promise.resolve();
  const task = prev.then(async () => {
    let lastErr = "";
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const r = await callRefresh(refreshUrl, timeoutMs);
      if (r.ok) {
        await new Promise((res) => setTimeout(res, MIN_GAP_MS));
        return { ok: true, body: r.body };
      }
      lastErr = r.error ?? "unknown";
      // 429 → backoff dài (provider rate-limit theo phút); 5xx → ngắn hơn
      if (r.status === 429 || (r.status && r.status >= 500) || !r.status) {
        const baseMs = r.status === 429 ? 15000 : 5000;
        const stepMs = r.status === 429 ? 15000 : 5000;
        const backoff = baseMs + stepMs * (attempt - 1) + Math.floor(Math.random() * 3000);
        await new Promise((res) => setTimeout(res, backoff));
        continue;
      }
      break;
    }
    return { ok: false, error: lastErr };
  });

  refreshQueue.set(refreshUrl, task.catch(() => {}));
  return task;
}
