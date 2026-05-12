"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play, Square, PackageSearch, CheckCircle2, XCircle,
  Loader2, ClipboardList, ChevronDown, ChevronUp, Download,
  RefreshCw, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type OmniProxy = { id: number; name?: string; host: string; port: number; proxy_type: string };

type LogEntry = {
  id: number;
  label: string;
  message: string;
  level?: "info" | "warn" | "error";
  ts: string;
};

type Result = {
  label: string;
  profileName: string;
  email: string;
  success: boolean;
  step?: string;
  stepLabel?: string;
  error?: string;
};

type SSEEvent =
  | { type: "log"; label: string; message: string; level?: "info" | "warn" | "error" }
  | { type: "result"; label: string; profileName: string; email: string; success: boolean; step?: string; stepLabel?: string; error?: string }
  | { type: "done" };

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_STYLES: Record<string, string> = {
  step1:     "border-blue-500/40 bg-blue-500/10 text-blue-400",
  step2:     "border-amber-500/40 bg-amber-500/10 text-amber-400",
  step3:     "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  not_found: "border-border/40 bg-muted/30 text-muted-foreground",
};

const LABEL_COLORS = [
  "text-sky-400", "text-violet-400", "text-rose-400",
  "text-lime-400", "text-orange-400", "text-fuchsia-400",
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

function useLabelColor() {
  const map = useRef<Record<string, string>>({});
  const idx = useRef(0);
  return (label: string) => {
    if (!map.current[label]) {
      map.current[label] = LABEL_COLORS[idx.current % LABEL_COLORS.length];
      idx.current++;
    }
    return map.current[label];
  };
}

function proxyLabel(p: OmniProxy) {
  return p.name || `${p.host}:${p.port}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ACCOUNT_PLACEHOLDER = `TenProfile|email@example.com|MatKhau123
TenProfile2|other@example.com|MatKhau456`;

export function OrderChecker() {
  // Inputs
  const [accounts, setAccounts] = useState("");
  const [productCode, setProductCode] = useState("");
  const [threadCount, setThreadCount] = useState(1);
  const [threadProxies, setThreadProxies] = useState<(number | null)[]>([null]);
  const [proxies, setProxies] = useState<OmniProxy[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(false);

  // Run state
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logsVisible, setLogsVisible] = useState(true);
  const [hasFinished, setHasFinished] = useState(false);

  // Refs
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const getLabelColor = useLabelColor();
  // email → { profileName, password } snapshot trước khi chạy
  const accountMapRef = useRef<Record<string, { profileName: string; password: string }>>({});

  // Fetch proxy list from Omni
  async function loadProxies() {
    setProxiesLoading(true);
    try {
      const res = await fetch("/api/omni-proxies");
      if (res.ok) {
        const data = await res.json();
        setProxies(data.proxies ?? []);
      }
    } catch {}
    setProxiesLoading(false);
  }

  useEffect(() => { loadProxies(); }, []);

  // Warn before leaving when running or has results
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (running || hasFinished) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running, hasFinished]);

  // Sync threadProxies array length with threadCount
  function handleThreadCountChange(count: number) {
    setThreadCount(count);
    setThreadProxies((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(null);
      return next.slice(0, count);
    });
  }

  function setProxyForThread(idx: number, proxyId: number) {
    setThreadProxies((prev) => {
      const next = [...prev];
      next[idx] = proxyId;
      return next;
    });
  }

  function pushLog(label: string, message: string, level?: "info" | "warn" | "error") {
    const ts = new Date().toLocaleTimeString("vi-VN", { hour12: false });
    setLogs((prev) => [...prev, { id: logIdRef.current++, label, message, level, ts }]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  // ─── Run ───────────────────────────────────────────────────────────────────

  async function handleRun(overrideAccounts?: string) {
    const accountsToRun = overrideAccounts ?? accounts;
    if (!accountsToRun.trim() || !productCode.trim()) return;
    if (threadProxies.some((p) => p === null)) return;

    // Snapshot email → password trước khi chạy
    accountMapRef.current = {};
    for (const line of accountsToRun.split("\n")) {
      const parts = line.trim().split("|").map((p) => p.trim());
      if (parts.length >= 3) accountMapRef.current[parts[1]] = { profileName: parts[0], password: parts[2] };
    }

    setRunning(true);
    setLogs([]);
    setResults([]);
    setError(null);
    setHasFinished(false);
    logIdRef.current = 0;

    try {
      const res = await fetch("/api/pokemon-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accounts: accountsToRun,
          productCode: productCode.trim(),
          concurrency: threadCount,
          threadProxies,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Yêu cầu thất bại");
        setRunning(false);
        return;
      }

      const reader = res.body!.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              if (event.type === "log") {
                pushLog(event.label, event.message, event.level);
              } else if (event.type === "result") {
                setResults((prev) => [...prev, event]);
                pushLog(event.label, event.success ? `✓ ${event.stepLabel}` : `✗ ${event.error}`, event.success ? "info" : "error");
              } else if (event.type === "done") {
                setRunning(false);
                setHasFinished(true);
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Lỗi kết nối");
    } finally {
      setRunning(false);
    }
  }

  function handleStop() {
    readerRef.current?.cancel();
    readerRef.current = null;
    setRunning(false);
  }

  // Re-run only failed accounts
  function handleRerunFailed() {
    const failedLines = results
      .filter((r) => !r.success)
      .map((r) => {
        const pw = accountMapRef.current[r.email]?.password ?? "";
        return `${r.profileName}|${r.email}|${pw}`;
      })
      .join("\n");
    setAccounts(failedLines);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Export Excel
  async function handleExport() {
    const res = await fetch("/api/pokemon-order/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ket-qua-pokemon.xls";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);
  const allProxiesSelected = threadProxies.every((p) => p !== null);
  const canRun = !running && accounts.trim() && productCode.trim() && allProxiesSelected;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Account Input ── */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Danh sách tài khoản
        </label>
        <textarea
          className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-3 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
          rows={5}
          placeholder={ACCOUNT_PLACEHOLDER}
          value={accounts}
          onChange={(e) => setAccounts(e.target.value)}
          disabled={running}
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Mỗi dòng:{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px]">
            ProfileName|Email|Password
          </code>
        </p>
      </div>

      {/* ── Product Code ── */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Mã sản phẩm
        </label>
        <input
          type="text"
          className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
          placeholder="Ví dụ: 9900000007904"
          value={productCode}
          onChange={(e) => setProductCode(e.target.value.trim())}
          disabled={running}
        />
        <p className="text-xs text-muted-foreground">
          Mã nằm trong URL ảnh sản phẩm:{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px]">/img/item/{"<mã>"}/</code>
        </p>
      </div>

      {/* ── Threads & Proxies ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Số luồng
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={threadCount}
            onChange={(e) => {
              const v = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
              handleThreadCountChange(v);
            }}
            disabled={running}
            className="h-8 w-20 rounded-lg border border-border/60 bg-background/60 px-2.5 text-center text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
          />

          <button
            onClick={loadProxies}
            disabled={proxiesLoading || running}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${proxiesLoading ? "animate-spin" : ""}`} />
            Tải proxy
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: threadCount }, (_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                Luồng {i + 1}
              </span>
              <Select
                value={threadProxies[i] != null ? String(threadProxies[i]) : ""}
                onValueChange={(v) => setProxyForThread(i, Number(v))}
                disabled={running || proxies.length === 0}
              >
                <SelectTrigger className="h-7 flex-1 rounded-lg text-xs">
                  {threadProxies[i] != null
                    ? <span>{proxyLabel(proxies.find((p) => p.id === threadProxies[i])!)}</span>
                    : <span className="text-muted-foreground">{proxiesLoading ? "Đang tải..." : "Chọn proxy"}</span>
                  }
                </SelectTrigger>
                <SelectContent>
                  {proxies.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {proxyLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {proxies.length === 0 && !proxiesLoading && (
          <p className="text-xs text-amber-400">
            Chưa có proxy nào. Hãy thêm proxy trong Omni rồi bấm &quot;Tải proxy&quot;.
          </p>
        )}
      </div>

      {/* ── Action Button ── */}
      <button
        onClick={running ? handleStop : () => handleRun()}
        disabled={!running && !canRun}
        className={`inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          running
            ? "border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "bg-primary text-primary-foreground shadow-[0_18px_38px_-24px_rgba(44,143,153,0.42)] hover:brightness-105"
        }`}
      >
        {running ? (
          <><Square className="h-4 w-4" /> Dừng</>
        ) : (
          <><Play className="h-4 w-4" /> Bắt đầu kiểm tra</>
        )}
      </button>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Logs ── */}
      {(logs.length > 0 || running) && (
        <div className="space-y-2">
          <button
            onClick={() => setLogsVisible((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
          >
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Logs trực tiếp
            </span>
            {running && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            <span className="ml-auto text-muted-foreground/60">
              {logsVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>

          {logsVisible && (
            <div className="h-56 overflow-y-auto rounded-xl border border-border/50 bg-[#0c0f18] p-3 font-mono text-xs leading-relaxed">
              {logs.map((entry) => (
                <div key={entry.id} className="flex gap-2">
                  <span className="shrink-0 text-muted-foreground/40">{entry.ts}</span>
                  <span className={`shrink-0 font-semibold ${getLabelColor(entry.label)}`}>
                    [{entry.label}]
                  </span>
                  <span className={
                    entry.level === "error" ? "text-rose-400"
                    : entry.level === "warn" ? "text-amber-400"
                    : "text-slate-300"
                  }>
                    {entry.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {results.length > 0 && (
        <div className="space-y-3">
          {/* Header + actions */}
          <div className="flex flex-wrap items-center gap-3">
            <PackageSearch className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Kết quả
            </span>
            <Badge variant="outline" className={`text-xs ${successCount === results.length ? "border-emerald-500/40 text-emerald-400" : "border-amber-500/40 text-amber-400"}`}>
              {successCount}/{results.length} thành công
            </Badge>
            <button
              onClick={handleExport}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 text-xs font-medium hover:bg-muted/40"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất Excel
            </button>
          </div>

          {/* Result list — one row per account */}
          <div className="rounded-xl border border-border/50 bg-[#0c0f18] overflow-hidden">
            {results.map((result, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 font-mono text-sm ${i > 0 ? "border-t border-border/30" : ""}`}
              >
                {result.success
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  : <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                <span className="w-40 shrink-0 truncate font-semibold text-foreground">
                  {result.profileName}
                </span>
                {result.success && result.stepLabel ? (
                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${STEP_STYLES[result.step ?? ""] ?? "border-border/60 bg-muted/40 text-muted-foreground"}`}>
                    {result.stepLabel}
                  </span>
                ) : (
                  <span className="text-xs text-rose-400">{result.error}</span>
                )}
              </div>
            ))}
          </div>

          {/* Failed accounts */}
          {failedResults.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">
                  {failedResults.length} tài khoản thất bại
                </span>
              </div>
              <div className="font-mono text-xs text-muted-foreground space-y-0.5">
                {failedResults.map((r, i) => (
                  <div key={i}>{r.profileName} — {r.email} — {r.error}</div>
                ))}
              </div>
              <button
                onClick={handleRerunFailed}
                disabled={running}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Điền lại danh sách lỗi để chạy lại
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
