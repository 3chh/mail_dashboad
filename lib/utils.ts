import type { MailboxStatus } from "@prisma/client";
import { type ClassValue, clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

const mailboxNameCollator = new Intl.Collator("vi-VN", {
  sensitivity: "base",
  numeric: true,
});

const mailboxStatusSortOrder: Record<MailboxStatus, number> = {
  ACTIVE: 0,
  PENDING_CONSENT: 1,
  RECONNECT_REQUIRED: 2,
  ERROR: 3,
  DISABLED: 4,
  DRAFT: 5,
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(value: Date | string | null | undefined) {
  if (!value) {
    return "không có";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "không có";
  }

  return `${formatDistanceToNowStrict(date, { locale: vi })} trước`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "không có";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "không có";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCurrency(amount: number | null | undefined, currency = "USD") {
  if (amount == null || Number.isNaN(amount)) {
    return "không có";
  }

  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "VND" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatPercentage(value: number) {
  return `${value}%`;
}

export function initialsFromName(value: string | null | undefined) {
  if (!value) {
    return "?";
  }

  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function truncate(value: string | null | undefined, length = 120) {
  if (!value) {
    return "";
  }

  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

export function parseLabelList(value: string | null | undefined) {
  return (
    value
      ?.split(",")
      .map((label) => label.trim())
      .filter(Boolean) ?? []
  );
}

export function normalizeWarehouseAddress(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKC")
    .replace(/[\s/\_.(),\[\]\-]/g, "")
    .replace(/[\u3012\u3001\u3002\u30fb\u300c\u300d\u300e\u300f\u3010\u3011\u30fc]/g, "")
    .toLowerCase();
}

export function extractPostalCode(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/\b(\d{3})-?(\d{4})\b/);
  return match ? `${match[1]}${match[2]}` : null;
}

export function compareMailboxesByStatusDisplayNameEmail<
  T extends {
    status: MailboxStatus;
    displayName: string | null;
    emailAddress: string;
  },
>(left: T, right: T) {
  const statusDiff = mailboxStatusSortOrder[left.status] - mailboxStatusSortOrder[right.status];
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const leftDisplayName = left.displayName?.trim() ?? "";
  const rightDisplayName = right.displayName?.trim() ?? "";
  const leftHasDisplayName = leftDisplayName.length > 0;
  const rightHasDisplayName = rightDisplayName.length > 0;

  if (leftHasDisplayName !== rightHasDisplayName) {
    return leftHasDisplayName ? -1 : 1;
  }

  if (leftHasDisplayName && rightHasDisplayName) {
    const displayNameDiff = mailboxNameCollator.compare(leftDisplayName, rightDisplayName);
    if (displayNameDiff !== 0) {
      return displayNameDiff;
    }
  }

  return mailboxNameCollator.compare(left.emailAddress.trim().toLowerCase(), right.emailAddress.trim().toLowerCase());
}
