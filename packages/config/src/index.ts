/**
 * Shared constants and configuration for StayFlow PMS.
 */

export const APP_NAME = "StayFlow";
export const API_VERSION = "v1";

export const STAY_TYPES = {
  HOURLY: "HOURLY",
  DAY_USE: "DAY_USE",
  OVERNIGHT: "OVERNIGHT",
  DAILY: "DAILY",
} as const;

export type StayType = (typeof STAY_TYPES)[keyof typeof STAY_TYPES];

export const ROOM_STATUSES = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  OCCUPIED: "OCCUPIED",
  CLEANING: "CLEANING",
  MAINTENANCE: "MAINTENANCE",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
} as const;

export type RoomStatus = (typeof ROOM_STATUSES)[keyof typeof ROOM_STATUSES];

export const ROOM_STATUS_CONFIG: Record<
  RoomStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  AVAILABLE: {
    label: "Available",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  RESERVED: {
    label: "Reserved",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  OCCUPIED: {
    label: "Occupied",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  CLEANING: {
    label: "Cleaning",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  MAINTENANCE: {
    label: "Maintenance",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  OUT_OF_SERVICE: {
    label: "Out of Service",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    dot: "bg-slate-500",
  },
};

export const HOUSEKEEPING_STATUSES = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export const HOUSEKEEPING_STATUS_CONFIG: Record<
  keyof typeof HOUSEKEEPING_STATUSES,
  { label: string; bg: string; text: string }
> = {
  PENDING: { label: "Pending", bg: "bg-amber-100", text: "text-amber-800" },
  IN_PROGRESS: { label: "In Progress", bg: "bg-blue-100", text: "text-blue-800" },
  COMPLETED: { label: "Completed", bg: "bg-emerald-100", text: "text-emerald-800" },
};

export const BOOKING_SOURCES = {
  WALK_IN: "Walk-in",
  PHONE: "Phone Call",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Direct Website",
  OTA: "Online Travel Agency",
  OTHER: "Other",
} as const;

export const PAYMENT_METHODS = {
  CASH: "Cash",
  CARD: "Credit/Debit Card",
  BANK_TRANSFER: "Bank Transfer",
  QR: "QR Payment",
  ONLINE: "Online Gateway",
} as const;

export const DEFAULT_BUSINESS_RULES = {
  OVERTIME_GRACE_MINUTES: 30,
  DEFAULT_CHECKIN_HOUR: 14,
  DEFAULT_CHECKOUT_HOUR: 11,
  DOCUMENT_RETENTION_DAYS: 365,
};
