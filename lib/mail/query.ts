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

export function parseLookbackDays(rawValue?: string | null, fallback = 30, max = 90) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, max);
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

  return !normalized.includes("\u3010");
}

function compactWhitespaceOnly(value: string) {
  return value.replace(/〒/g, "").replace(/\s+/g, "");
}

export function extractAddressCandidates(bodyText: string) {
  const lines = bodyText.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.includes("\u3012")) {
      continue;
    }

    const trimmedLine = line.trim();
    const postalIndex = trimmedLine.indexOf("\u3012");
    const addressLine = trimmedLine
      .slice(postalIndex >= 0 ? postalIndex + 1 : 0)
      .trim();
    const nextLine = lines[index + 1]?.trim();
    const combined = `${addressLine}${shouldAppendNextAddressLine(nextLine) ? ` ${nextLine}` : ""}`.trim();

    if (combined) {
      return [combined];
    }
  }

  return [];
}

export function extractAddressLine(bodyText: string) {
  const candidates = extractAddressCandidates(bodyText);
  return candidates[0] ?? "N/A";
}

function findLongestCommonBlock(left: string, right: string) {
  let bestLeft = 0;
  let bestRight = 0;
  let bestSize = 0;
  const rows = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = right.length; rightIndex >= 1; rightIndex -= 1) {
      if (left[leftIndex - 1] === right[rightIndex - 1]) {
        rows[rightIndex] = rows[rightIndex - 1] + 1;
        if (rows[rightIndex] > bestSize) {
          bestSize = rows[rightIndex];
          bestLeft = leftIndex - bestSize;
          bestRight = rightIndex - bestSize;
        }
      } else {
        rows[rightIndex] = 0;
      }
    }
  }

  return { bestLeft, bestRight, bestSize };
}

function calculateSequenceMatcherRatio(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  const stack: Array<{ left: string; right: string }> = [{ left, right }];
  let matches = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    const block = findLongestCommonBlock(current.left, current.right);

    if (block.bestSize === 0) {
      continue;
    }

    matches += block.bestSize;

    const leftBefore = current.left.slice(0, block.bestLeft);
    const rightBefore = current.right.slice(0, block.bestRight);
    const leftAfter = current.left.slice(block.bestLeft + block.bestSize);
    const rightAfter = current.right.slice(block.bestRight + block.bestSize);

    if (leftBefore && rightBefore) {
      stack.push({ left: leftBefore, right: rightBefore });
    }

    if (leftAfter && rightAfter) {
      stack.push({ left: leftAfter, right: rightAfter });
    }
  }

  return (2 * matches) / (left.length + right.length);
}

function normalizePostalPattern(postalCode: string) {
  return `${postalCode.slice(0, 3)}-?${postalCode.slice(3)}`;
}

function stripPostalCode(value: string, postalCode: string | null) {
  if (!postalCode) {
    return value;
  }

  return value.replace(new RegExp(normalizePostalPattern(postalCode), "g"), " ");
}

function extractAddressNumberTokens(value: string, postalCode: string | null) {
  const normalizedSource = value.normalize("NFKC");
  const withoutPostal = stripPostalCode(normalizedSource, postalCode);
  return withoutPostal.match(/\d+/g) ?? [];
}

function extractAddressTextToken(value: string, postalCode: string | null) {
  const normalized = normalizeWarehouseAddress(stripPostalCode(value, postalCode));
  return compactWhitespaceOnly(normalized.replace(/\d+/g, ""));
}

function countLeadingNumberMatches(left: string[], right: string[]) {
  let matches = 0;
  const limit = Math.min(left.length, right.length);

  while (matches < limit && left[matches] === right[matches]) {
    matches += 1;
  }

  return matches;
}

function countMatchedNumbers(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const counts = new Map<string, number>();
  for (const token of right) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  let matches = 0;
  for (const token of left) {
    const count = counts.get(token) ?? 0;
    if (count > 0) {
      matches += 1;
      counts.set(token, count - 1);
    }
  }

  return matches;
}

type WarehouseMatchRank = {
  postalExact: number;
  leadingNumberMatches: number;
  roomExact: number;
  matchedNumberCount: number;
  textContains: number;
  textSimilarity: number;
  overallSimilarity: number;
};

function compareWarehouseRanks(left: WarehouseMatchRank, right: WarehouseMatchRank) {
  if (left.postalExact !== right.postalExact) {
    return left.postalExact - right.postalExact;
  }

  if (left.leadingNumberMatches !== right.leadingNumberMatches) {
    return left.leadingNumberMatches - right.leadingNumberMatches;
  }

  if (left.roomExact !== right.roomExact) {
    return left.roomExact - right.roomExact;
  }

  if (left.matchedNumberCount !== right.matchedNumberCount) {
    return left.matchedNumberCount - right.matchedNumberCount;
  }

  if (left.textContains !== right.textContains) {
    return left.textContains - right.textContains;
  }

  if (left.textSimilarity !== right.textSimilarity) {
    return left.textSimilarity - right.textSimilarity;
  }

  return left.overallSimilarity - right.overallSimilarity;
}

function rankToScore(rank: WarehouseMatchRank) {
  return Number(
    (
      rank.postalExact * 1000 +
      rank.leadingNumberMatches * 100 +
      rank.roomExact * 10 +
      rank.matchedNumberCount +
      rank.textContains * 0.1 +
      rank.textSimilarity * 0.01 +
      rank.overallSimilarity * 0.001
    ).toFixed(6)
  );
}

function scoreWarehouseMatch(candidateAddress: string, warehouse: WarehouseLookupRow) {
  const candidatePostal = extractPostalCode(candidateAddress);
  const warehousePostal = extractPostalCode(warehouse.address);
  const normalizedCandidate = normalizeWarehouseAddress(candidateAddress);
  const normalizedWarehouseAddress = warehouse.normalizedAddress || normalizeWarehouseAddress(warehouse.address);
  const candidateNumbers = extractAddressNumberTokens(candidateAddress, candidatePostal);
  const warehouseNumbers = extractAddressNumberTokens(warehouse.address, warehousePostal);
  const candidateText = extractAddressTextToken(candidateAddress, candidatePostal);
  const warehouseText = extractAddressTextToken(warehouse.address, warehousePostal);

  const textSimilarity =
    candidateText && warehouseText ? calculateSequenceMatcherRatio(candidateText, warehouseText) : 0;
  const overallSimilarity = calculateSequenceMatcherRatio(normalizedWarehouseAddress, normalizedCandidate);
  const rank: WarehouseMatchRank = {
    postalExact: candidatePostal && warehousePostal && candidatePostal === warehousePostal ? 1 : 0,
    leadingNumberMatches: countLeadingNumberMatches(candidateNumbers, warehouseNumbers),
    roomExact:
      candidateNumbers.length > 0 &&
      warehouseNumbers.length > 0 &&
      candidateNumbers.at(-1) === warehouseNumbers.at(-1)
        ? 1
        : 0,
    matchedNumberCount: countMatchedNumbers(candidateNumbers, warehouseNumbers),
    textContains:
      candidateText && warehouseText && (candidateText.includes(warehouseText) || warehouseText.includes(candidateText)) ? 1 : 0,
    textSimilarity,
    overallSimilarity,
  };

  return {
    rank,
    score: rankToScore(rank),
  };
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
    score: -1,
  };
  let bestRank: WarehouseMatchRank | null = null;

  for (const candidate of candidates) {
    const candidatePostal = extractPostalCode(candidate);
    const samePostalWarehouses =
      candidatePostal
        ? warehouses.filter((warehouse) => extractPostalCode(warehouse.address) === candidatePostal)
        : [];
    const candidateWarehouses = samePostalWarehouses.length > 0 ? samePostalWarehouses : warehouses;

    for (const warehouse of candidateWarehouses) {
      const { rank, score } = scoreWarehouseMatch(candidate, warehouse);
      if (!bestRank || compareWarehouseRanks(rank, bestRank) > 0) {
        bestRank = rank;
        bestMatch = {
          address: candidate,
          warehouse: warehouse.name,
          score,
        };
      }
    }
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
    return "Đồng bộ 1 ngày";
  }

  return `Đồng bộ ${days} ngày`;
}
