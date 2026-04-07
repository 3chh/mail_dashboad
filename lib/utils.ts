import { type ClassValue, clsx } from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

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
