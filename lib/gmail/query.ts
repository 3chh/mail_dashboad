type SearchQueryInput = {
  gmailQuery?: string;
  keyword?: string;
  sender?: string;
  dateFrom?: string;
  dateTo?: string;
  unreadOnly?: boolean;
  withAttachments?: boolean;
};

function escapeQuotedValue(value: string) {
  return value.replace(/"/g, '\\"');
}

export function buildSearchQuery(input: SearchQueryInput) {
  const tokens: string[] = [];

  if (input.gmailQuery?.trim()) {
    tokens.push(input.gmailQuery.trim());
  }

  if (input.keyword?.trim()) {
    tokens.push(`"${escapeQuotedValue(input.keyword.trim())}"`);
  }

  if (input.sender?.trim()) {
    tokens.push(`from:${input.sender.trim()}`);
  }

  if (input.dateFrom) {
    tokens.push(`after:${input.dateFrom.replace(/-/g, "/")}`);
  }

  if (input.dateTo) {
    tokens.push(`before:${input.dateTo.replace(/-/g, "/")}`);
  }

  if (input.unreadOnly) {
    tokens.push("is:unread");
  }

  if (input.withAttachments) {
    tokens.push("has:attachment");
  }

  return tokens.join(" ").trim();
}

export function buildRecentScanQuery(days: number) {
  return `newer_than:${days}d`;
}
