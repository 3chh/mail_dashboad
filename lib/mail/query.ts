import { extractPostalCode, normalizeWarehouseAddress } from "@/lib/utils";

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

export type WarehouseLookupRow = {
  id: string;
  name: string;
  address: string;
  normalizedAddress: string;
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
  const patterns = [/\u3010\u9001\u308a\u72b6\u756a\u53f7\u3011\s*(\d{12})/i, /\b(\d{12})\b/];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "N/A";
}

function shouldAppendNextAddressLine(line: string | undefined) {
  if (!line) {
    return false;
  }

  const normalized = line.trim();
  if (!normalized) {
    return false;
  }

  return !/^(\u3010|\[|tracking|\u9001\u308a\u72b6|order|invoice|subject|\u4ef6\u540d)/i.test(normalized) && normalized.length <= 120;
}

export function extractAddressCandidates(bodyText: string) {
  const lines = bodyText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const looksLikePostalLine = line.includes("\u3012") || /\b\d{3}-\d{4}\b/.test(line) || /\b\d{7}\b/.test(line);

    if (!looksLikePostalLine) {
      continue;
    }

    const nextLine = lines[index + 1];
    const combined = `${line}${shouldAppendNextAddressLine(nextLine) ? ` ${nextLine}` : ""}`.trim();

    if (!seen.has(combined)) {
      seen.add(combined);
      candidates.push(combined);
    }
  }

  if (candidates.length === 0) {
    const fallback = lines.find((line) => /\b\d{3}-\d{4}\b/.test(line) || /\b\d{7}\b/.test(line));
    if (fallback) {
      candidates.push(fallback.trim());
    }
  }

  return candidates;
}

export function extractAddressLine(bodyText: string) {
  const candidates = extractAddressCandidates(bodyText);
  return candidates[0] ?? "N/A";
}

function buildCharacterBigrams(value: string) {
  if (value.length <= 1) {
    return [value];
  }

  const bigrams: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    bigrams.push(value.slice(index, index + 2));
  }
  return bigrams;
}

function calculateDiceSimilarity(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.96;
  }

  const leftBigrams = buildCharacterBigrams(left);
  const rightBigrams = buildCharacterBigrams(right);
  const counts = new Map<string, number>();

  for (const item of leftBigrams) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  let intersection = 0;
  for (const item of rightBigrams) {
    const count = counts.get(item) ?? 0;
    if (count > 0) {
      intersection += 1;
      counts.set(item, count - 1);
    }
  }

  return (2 * intersection) / (leftBigrams.length + rightBigrams.length);
}

function scoreWarehouseMatch(candidateAddress: string, warehouse: WarehouseLookupRow) {
  const normalizedCandidate = normalizeWarehouseAddress(candidateAddress);
  if (!normalizedCandidate || !warehouse.normalizedAddress) {
    return 0;
  }

  let score = calculateDiceSimilarity(normalizedCandidate, warehouse.normalizedAddress);
  const candidatePostal = extractPostalCode(candidateAddress);
  const warehousePostal = extractPostalCode(warehouse.address);

  if (candidatePostal && warehousePostal && candidatePostal === warehousePostal) {
    score += 0.12;
  }

  if (
    warehouse.normalizedAddress.includes(normalizedCandidate) ||
    normalizedCandidate.includes(warehouse.normalizedAddress)
  ) {
    score = Math.max(score, 0.97);
  }

  return Math.min(score, 1);
}

export function resolveWarehouseMatch(bodyText: string, warehouses: WarehouseLookupRow[]) {
  const candidates = extractAddressCandidates(bodyText);
  const fallbackAddress = candidates[0] ?? "N/A";

  if (warehouses.length === 0 || candidates.length === 0) {
    return {
      address: fallbackAddress,
      warehouse: "N/A",
      score: 0,
    };
  }

  let bestMatch: { address: string; warehouse: string; score: number } = {
    address: fallbackAddress,
    warehouse: "N/A",
    score: 0,
  };

  for (const candidate of candidates) {
    for (const warehouse of warehouses) {
      const score = scoreWarehouseMatch(candidate, warehouse);
      if (score > bestMatch.score) {
        bestMatch = {
          address: candidate,
          warehouse: warehouse.name,
          score,
        };
      }
    }
  }

  if (bestMatch.score < 0.45) {
    return {
      address: bestMatch.address || fallbackAddress,
      warehouse: "N/A",
      score: bestMatch.score,
    };
  }

  return bestMatch;
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
    return "??ng b? 1 ng?y";
  }

  return `??ng b? ${days} ng?y`;
}
