import { type ClassValue, clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(value: Date | string | null | undefined) {
  if (!value) {
    return "kh?ng c?";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "kh?ng c?";
  }

  return `${formatDistanceToNowStrict(date, { locale: vi })} tr??c`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "kh?ng c?";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "kh?ng c?";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCurrency(amount: number | null | undefined, currency = "USD") {
  if (amount == null || Number.isNaN(amount)) {
    return "kh?ng c?";
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
