import { z } from "zod";

// -------------------------
// Common
// -------------------------
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// -------------------------
// Auth
// -------------------------
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string().min(1),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

// -------------------------
// Organization
// -------------------------
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().default("UTC"),
  currency: z.string().length(3).default("USD"),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// -------------------------
// Property
// -------------------------
export const createPropertySchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().min(5),
  city: z.string().min(2),
  country: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  timezone: z.string().default("UTC"),
  check_in_time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be HH:MM")
    .default("14:00"),
  check_out_time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Must be HH:MM")
    .default("11:00"),
});

export const updatePropertySchema = createPropertySchema.partial();

// -------------------------
// Room Type
// -------------------------
export const createRoomTypeSchema = z.object({
  property_id: uuidSchema,
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  is_ac: z.boolean().default(true),
  max_guests: z.number().int().min(1).max(20),
  base_hourly_rate: z.number().min(0),
  base_day_use_rate: z.number().min(0),
  base_nightly_rate: z.number().min(0),
  base_daily_rate: z.number().min(0),
  extra_hour_rate: z.number().min(0).default(0),
  extra_guest_rate: z.number().min(0).default(0),
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial().omit({ property_id: true });

// -------------------------
// Room
// -------------------------
export const createRoomSchema = z.object({
  property_id: uuidSchema,
  room_type_id: uuidSchema,
  room_number: z.string().min(1).max(20),
  floor: z.string().max(10).optional(),
  max_guests: z.number().int().min(1).max(20).optional(),
  notes: z.string().optional(),
});

export const updateRoomSchema = createRoomSchema.partial().omit({ property_id: true });

export const updateRoomStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "RESERVED", "OCCUPIED", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"]),
  notes: z.string().optional(),
});

// -------------------------
// Guest
// -------------------------
export const createGuestSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(200),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  date_of_birth: z.string().date().optional().or(z.literal("")),
  address: z.string().optional(),
  preferred_language: z.string().optional(),
  notes: z.string().optional(),
});

export const updateGuestSchema = createGuestSchema.partial();

// -------------------------
// Identity
// -------------------------
export const uploadDocumentSchema = z.object({
  guest_id: uuidSchema,
  document_type: z.enum(["NATIONAL_ID", "PASSPORT", "DRIVING_LICENCE"]),
});

export const confirmVerificationSchema = z.object({
  document_id: uuidSchema,
  document_number: z.string().optional(),
  full_name: z.string().optional(),
  date_of_birth: z.string().date().optional().or(z.literal("")),
  address: z.string().optional(),
  status: z.enum(["CONFIRMED", "REJECTED"]),
  notes: z.string().optional(),
});

// -------------------------
// Reservation
// -------------------------
export const createReservationSchema = z.object({
  property_id: uuidSchema,
  room_id: uuidSchema,
  primary_guest_id: uuidSchema,
  stay_type: z.enum(["HOURLY", "DAY_USE", "OVERNIGHT", "DAILY"]),
  check_in_date: z.string().date(),
  check_in_time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  expected_checkout_date: z.string().date(),
  expected_checkout_time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  num_guests: z.number().int().min(1).default(1),
  booking_source: z
    .enum(["WALK_IN", "PHONE", "WHATSAPP", "WEBSITE", "OTA", "OTHER"])
    .default("WALK_IN"),
  special_requests: z.string().optional(),
  notes: z.string().optional(),
  advance_payment: z.number().min(0).default(0),
});

export const updateReservationSchema = createReservationSchema.partial().omit({ property_id: true });

export const cancelReservationSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
});

// -------------------------
// Check-in
// -------------------------
export const checkInSchema = z.object({
  reservation_id: uuidSchema.optional(),
  property_id: uuidSchema,
  room_id: uuidSchema,
  primary_guest_id: uuidSchema,
  stay_type: z.enum(["HOURLY", "DAY_USE", "OVERNIGHT", "DAILY"]),
  expected_checkout: z.string().datetime({ offset: true }),
  num_guests: z.number().int().min(1).default(1),
  notes: z.string().optional(),
});

// -------------------------
// Folio / Services
// -------------------------
export const addFolioItemSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  notes: z.string().optional(),
});

export const addServiceOrderSchema = z.object({
  service_id: uuidSchema,
  quantity: z.number().int().positive().default(1),
  unit_price: z.number().min(0).optional(), // override price
  notes: z.string().optional(),
});

// -------------------------
// Checkout
// -------------------------
export const checkoutSchema = z.object({
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

// -------------------------
// Payment
// -------------------------
export const createPaymentSchema = z.object({
  payment_method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "QR", "ONLINE"]),
  amount: z.number().positive("Amount must be greater than 0"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const createRefundSchema = z.object({
  payment_id: uuidSchema,
  amount: z.number().positive(),
  reason: z.string().min(1, "Refund reason is required"),
});

// -------------------------
// Housekeeping
// -------------------------
export const updateHousekeepingTaskSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
  assigned_to: uuidSchema.optional(),
  notes: z.string().optional(),
});

// -------------------------
// Staff
// -------------------------
export const inviteStaffSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2).max(200),
  role: z.enum(["OWNER", "MANAGER", "RECEPTIONIST", "HOUSEKEEPER"]),
  property_ids: z.array(uuidSchema).optional(),
});

// -------------------------
// Reports
// -------------------------
export const revenueReportSchema = z.object({
  from_date: z.string().date(),
  to_date: z.string().date(),
  property_id: uuidSchema.optional(),
  group_by: z.enum(["day", "week", "month"]).default("day"),
});

export const occupancyReportSchema = z.object({
  from_date: z.string().date(),
  to_date: z.string().date(),
  property_id: uuidSchema.optional(),
});

// -------------------------
// Type exports
// -------------------------
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdateHousekeepingTaskInput = z.infer<typeof updateHousekeepingTaskSchema>;
