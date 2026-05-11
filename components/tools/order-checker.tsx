"use client";

import { useRef, useState } from "react";
import { Play, Square, PackageSearch, CheckCircle2, XCircle, Loader2, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogEntry = {
  id: number;
  label: string;
  message: string;
  level?: "info" | "warn" | "error";
  ts: string;
};

type Result = {
  label: string;
  success: boolean;
  step?: string;
  stepLabel?: string;
  error?: string;
};

type SSEEvent =
  | { type: "log"; label: string; message: string; level?: "info" | "warn" | "error" }
  | { type: "result"; label: string; success: boolean; step?: string; stepLabel?: string; error?: string }
  | { type: "done" };

// ─── Step badge ───────────────────────────────────────────────────────────────

const STEP_STYLES: Record<string, string> = {
  step1: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  step2: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  step3: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

const STEP_DOTS: Record<string, string> = {
  step1: "bg-blue-400",
  step2: "bg-amber-400",
  step3: "bg-emerald-400",
};

// ─── Log colors by label ──────────────────────────────────────────────────────

const LABEL_COLORS = [
  "text-sky-400",
  "text-violet-400",
  "text-rose-400",
  "text-lime-400",
  "text-orange-400",
  "text-fuchsia-400",
];

function useLabelColor() {
  const map = useRef<Record<string, string>>({});
  let idx = useRef(0);
  return (label: string) => {
    if (!map.current[label]) {
      map.current[label] = LABEL_COLORS[idx.current % LABEL_COLORS.length];
      idx.current++;
    }
    return map.current[label];
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const PLACEHOLDER = `1|email@example.com|Password123|3000008988106
2|other@example.com|Password456|3000011120092`;

export function OrderChecker() {
  const [accounts, setAccounts] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const getLabelColor = useLabelColor();

  function pushLog(label: string, message: string, level?: "info" | "warn" | "error") {
    const now = new Date();
    const ts = now.toLocaleTimeString("vi-VN", { hour12: false });
    setLogs((prev) => [...prev, { id: logIdRef.current++, label, message, level, ts }]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  async function handleRun() {
    if (!accounts.trim()) return;
    setRunning(true);
    setLogs([]);
    setResults([]);
    setError(null);
    logIdRef.current = 0;

    try {
      const res = await fetch("/api/pokemon-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
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

  const hasOutput = logs.length > 0 || results.length > 0;

  return (
    <div className="space-y-5">
      {/* Input */}
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Danh sách tài khoản
          </label>
          <textarea
            className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-3 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
            rows={5}
            placeholder={PLACEHOLDER}
            value={accounts}
            onChange={(e) => setAccounts(e.target.value)}
            disabled={running}
            spellCheck={false}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Mỗi dòng một tài khoản theo định dạng:{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px]">
              ProxyId|Email|Password|ProductCode
            </code>
          </p>
        </div>

        <button
          onClick={running ? handleStop : handleRun}
          disabled={!running && !accounts.trim()}
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
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Live Logs */}
      {hasOutput && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Logs trực tiếp
            </span>
            {running && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </div>

          <div className="h-64 overflow-y-auto rounded-xl border border-border/50 bg-[#0c0f18] p-3 font-mono text-xs leading-relaxed">
            {logs.map((entry) => (
              <div key={entry.id} className="flex gap-2">
                <span className="shrink-0 text-muted-foreground/40">{entry.ts}</span>
                <span className={`shrink-0 font-semibold ${getLabelColor(entry.label)}`}>
                  [{entry.label}]
                </span>
                <span
                  className={
                    entry.level === "error"
                      ? "text-rose-400"
                      : entry.level === "warn"
                      ? "text-amber-400"
                      : "text-slate-300"
                  }
                >
                  {entry.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Kết quả
            </span>
            <Badge variant="outline" className="text-xs">
              {results.filter((r) => r.success).length}/{results.length} thành công
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((result) => (
              <Card
                key={result.label}
                className={`rounded-2xl border ${
                  result.success
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-destructive/20 bg-destructive/5"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <span className="truncate font-mono text-sm font-semibold text-foreground">
                          {result.label}
                        </span>
                      </div>

                      {result.success && result.stepLabel ? (
                        <div className="mt-2.5 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                              STEP_STYLES[result.step ?? ""] ?? "border-border/60 bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${STEP_DOTS[result.step ?? ""] ?? "bg-muted-foreground"}`}
                            />
                            {result.stepLabel}
                          </span>
                        </div>
                      ) : result.error ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">{result.error}</p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
