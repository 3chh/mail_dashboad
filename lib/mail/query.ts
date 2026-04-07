type LocalSearchInput = {
  keyword?: string;
  sender?: string;
  dateFrom?: string;
  dateTo?: string;
  unreadOnly?: boolean;
  withAttachments?: boolean;
  mode?: "body" | "order";
  lookbackDays?: number;
};

export function parseRequiredKeywords(rawKeyword?: string) {
  if (!rawKeyword) {
    return [];
  }

  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const item of rawKeyword.split("/")) {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    keywords.push(normalized);
  }

  return keywords;
}

export function parseLookbackDays(rawValue?: string | null, fallback = 30) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

export function parseSearchMode(rawValue?: string | null) {
  return rawValue === "order" ? "order" : "body";
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildKeywordHaystack(parts: Array<string | null | undefined>) {
  return normalizeSearchText(parts.filter(Boolean).join("\n"));
}

export function messageMatchesRequiredKeywords(parts: Array<string | null | undefined>, rawKeyword?: string) {
  const requiredKeywords = parseRequiredKeywords(rawKeyword);
  if (requiredKeywords.length === 0) {
    return true;
  }

  const haystack = buildKeywordHaystack(parts);
  return requiredKeywords.every((keyword) => haystack.includes(normalizeSearchText(keyword)));
}

export function extractNumericSortValue(value: string | null | undefined) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function formatSearchExportDate(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (input: number) => String(input).padStart(2, "0");

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(" ");
}

export function extractTrackingNumber(bodyText: string) {
  const patterns = [
    /【送り状番号】\s*(\d{12})/i,
    /ã€é€ã‚ŠçŠ¶ç•ªå·ã€‘\s*(\d{12})/i,
    /\b(\d{12})\b/,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "N/A";
}

export function extractAddressLine(bodyText: string) {
  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const looksLikePostal =
      line.includes("〒") ||
      line.includes("ã€’") ||
      /\b\d{3}-\d{4}\b/.test(line);

    if (!looksLikePostal) {
      continue;
    }

    const nextLine = lines[index + 1];
    const appendNextLine =
      nextLine &&
      !/^(【|\[|tracking|送り状|order|invoice|subject)/i.test(nextLine) &&
      nextLine.length <= 120;

    return `${line}${appendNextLine ? ` ${nextLine}` : ""}`;
  }

  return "N/A";
}

export function buildLocalSearchSummary(input: LocalSearchInput) {
  const parts: string[] = [];
  const requiredKeywords = parseRequiredKeywords(input.keyword);

  parts.push(input.mode === "order" ? "mode:order" : "mode:body");

  if (input.lookbackDays) {
    parts.push(`days:${input.lookbackDays}`);
  }

  if (requiredKeywords.length > 0) {
    parts.push(`all-keywords:${requiredKeywords.join(" / ")}`);
  }

  if (input.sender?.trim()) {
    parts.push(`sender:${input.sender.trim()}`);
  }

  if (input.dateFrom) {
    parts.push(`from:${input.dateFrom}`);
  }

  if (input.dateTo) {
    parts.push(`to:${input.dateTo}`);
  }

  if (input.unreadOnly) {
    parts.push("unread");
  }

  if (input.withAttachments) {
    parts.push("attachment");
  }

  return parts.join(" | ");
}

export function buildSyncJobLabel(days: number) {
  if (days <= 1) {
    return "Đồng bộ 1 ngày";
  }

  return `Đồng bộ ${days} ngày`;
}