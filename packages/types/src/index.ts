// =============================================================================
// StayFlow — Shared Types
// =============================================================================

// -------------------------
// Common
// -------------------------
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface PaginatedRequest {
  page?: number;
  page_size?: number;
  search?: string;
}

// -------------------------
// Enums
// -------------------------
export enum UserRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  RECEPTIONIST = "RECEPTIONIST",
  HOUSEKEEPER = "HOUSEKEEPER",
}

export enum RoomStatus {
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  OCCUPIED = "OCCUPIED",
  CLEANING = "CLEANING",
  MAINTENANCE = "MAINTENANCE",
  OUT_OF_SERVICE = "OUT_OF_SERVICE",
}

export enum StayType {
  HOURLY = "HOURLY",
  DAY_USE = "DAY_USE",
  OVERNIGHT = "OVERNIGHT",
  DAILY = "DAILY",
}

export enum ReservationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export enum BookingSource {
  WALK_IN = "WALK_IN",
  PHONE = "PHONE",
  WHATSAPP = "WHATSAPP",
  WEBSITE = "WEBSITE",
  OTA = "OTA",
  OTHER = "OTHER",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  QR = "QR",
  ONLINE = "ONLINE",
}

export enum DocumentType {
  NATIONAL_ID = "NATIONAL_ID",
  PASSPORT = "PASSPORT",
  DRIVING_LICENCE = "DRIVING_LICENCE",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

export enum HousekeepingStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export enum ServiceCategory {
  FOOD = "FOOD",
  DRINK = "DRINK",
  MINIBAR = "MINIBAR",
  LAUNDRY = "LAUNDRY",
  ROOM_SERVICE = "ROOM_SERVICE",
  OTHER = "OTHER",
}

export enum NotificationEvent {
  NEW_BOOKING = "NEW_BOOKING",
  CHECK_IN_REMINDER = "CHECK_IN_REMINDER",
  CHECKOUT_APPROACHING = "CHECKOUT_APPROACHING",
  CHECKOUT_OVERDUE = "CHECKOUT_OVERDUE",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  ROOM_READY = "ROOM_READY",
  HOUSEKEEPING_ASSIGNED = "HOUSEKEEPING_ASSIGNED",
}

// -------------------------
// User / Auth
// -------------------------
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: UserRole;
  is_active: boolean;
}

// -------------------------
// Organization
// -------------------------
export interface Organization {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  timezone: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -------------------------
// Property
// -------------------------
export interface Property {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  email?: string;
  timezone: string;
  check_in_time: string;   // HH:MM
  check_out_time: string;  // HH:MM
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// -------------------------
// Room Type
// -------------------------
export interface RoomType {
  id: string;
  property_id: string;
  name: string;
  description?: string;
  is_ac: boolean;
  max_guests: number;
  base_hourly_rate: number;
  base_day_use_rate: number;
  base_nightly_rate: number;
  base_daily_rate: number;
  extra_hour_rate: number;
  extra_guest_rate: number;
  amenities: Amenity[];
  created_at: string;
  updated_at: string;
}

export interface Amenity {
  id: string;
  name: string;
  icon?: string;
}

// -------------------------
// Room
// -------------------------
export interface Room {
  id: string;
  property_id: string;
  room_type_id: string;
  room_type?: RoomType;
  room_number: string;
  floor?: string;
  max_guests: number;
  status: RoomStatus;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// -------------------------
// Guest
// -------------------------
export interface Guest {
  id: string;
  organization_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  date_of_birth?: string;
  address?: string;
  preferred_language?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface GuestDocument {
  id: string;
  guest_id: string;
  document_type: DocumentType;
  document_number?: string;
  full_name?: string;
  date_of_birth?: string;
  address?: string;
  file_key: string;           // S3 key (private)
  signed_url?: string;        // temporary signed URL for viewing
  signed_url_expires?: string;
  created_by: string;
  created_at: string;
}

export interface GuestVerification {
  id: string;
  guest_id: string;
  document_id: string;
  status: VerificationStatus;
  verified_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// -------------------------
// Reservation
// -------------------------
export interface Reservation {
  id: string;
  reservation_number: string;
  property_id: string;
  room_id: string;
  room?: Room;
  primary_guest_id: string;
  primary_guest?: Guest;
  stay_type: StayType;
  check_in_date: string;      // ISO date
  check_in_time?: string;     // HH:MM (for hourly/day-use)
  expected_checkout_date: string;
  expected_checkout_time?: string;
  num_guests: number;
  booking_source: BookingSource;
  status: ReservationStatus;
  special_requests?: string;
  notes?: string;
  advance_payment: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// -------------------------
// Stay
// -------------------------
export interface Stay {
  id: string;
  reservation_id?: string;
  property_id: string;
  room_id: string;
  room?: Room;
  primary_guest_id: string;
  primary_guest?: Guest;
  stay_type: StayType;
  actual_check_in: string;       // UTC ISO datetime
  expected_checkout: string;     // UTC ISO datetime
  actual_checkout?: string;
  num_guests: number;
  checked_in_by: string;
  checked_out_by?: string;
  folio_id?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

// -------------------------
// Pricing
// -------------------------
export interface PricingResult {
  room_charge: number;
  extra_hour_charge: number;
  extra_guest_charge: number;
  service_charge: number;
  discount: number;
  tax: number;
  subtotal: number;
  grand_total: number;
  paid_amount: number;
  balance: number;
  breakdown: PricingBreakdownItem[];
}

export interface PricingBreakdownItem {
  label: string;
  amount: number;
  is_deduction: boolean;
}

// -------------------------
// Folio / Invoice
// -------------------------
export interface Folio {
  id: string;
  stay_id: string;
  items: FolioItem[];
  total: number;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolioItem {
  id: string;
  folio_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_by: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  folio_id: string;
  stay_id: string;
  guest_id: string;
  items: InvoiceItem[];
  room_charge: number;
  services_total: number;
  discount: number;
  tax: number;
  grand_total: number;
  paid_amount: number;
  balance: number;
  is_finalized: boolean;
  finalized_at?: string;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;        // snapshot at time of invoice
  total: number;
}

// -------------------------
// Payment
// -------------------------
export interface Payment {
  id: string;
  invoice_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface Refund {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  created_by: string;
  created_at: string;
}

// -------------------------
// Service
// -------------------------
export interface Service {
  id: string;
  property_id: string;
  category: ServiceCategory;
  name: string;
  description?: string;
  unit_price: number;
  is_active: boolean;
}

export interface ServiceOrder {
  id: string;
  stay_id: string;
  folio_id: string;
  service_id: string;
  service?: Service;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

// -------------------------
// Housekeeping
// -------------------------
export interface HousekeepingTask {
  id: string;
  property_id: string;
  room_id: string;
  room?: Room;
  assigned_to?: string;
  assigned_user?: User;
  status: HousekeepingStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  notes?: string;
  created_at: string;
  completed_at?: string;
}

// -------------------------
// Audit Log
// -------------------------
export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  user?: User;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// -------------------------
// Dashboard
// -------------------------
export interface DashboardStats {
  available_rooms: number;
  occupied_rooms: number;
  reserved_rooms: number;
  cleaning_rooms: number;
  maintenance_rooms: number;
  todays_check_ins: number;
  todays_check_outs: number;
  upcoming_checkouts: UpcomingCheckout[];
  pending_payments_count: number;
  pending_payments_amount: number;
  todays_revenue: number;
}

export interface UpcomingCheckout {
  stay_id: string;
  room_number: string;
  guest_name: string;
  expected_checkout: string;
  stay_type: StayType;
  balance: number;
}

// -------------------------
// Reports
// -------------------------
export interface RevenueReport {
  period: string;
  total_revenue: number;
  room_revenue: number;
  service_revenue: number;
  payments_by_method: Record<string, number>;
  occupancy_rate: number;
  total_stays: number;
}

export interface OccupancyReport {
  period: string;
  total_rooms: number;
  occupied_days: number;
  available_days: number;
  occupancy_rate: number;
  by_room_type: RoomTypeOccupancy[];
}

export interface RoomTypeOccupancy {
  room_type_id: string;
  room_type_name: string;
  occupancy_rate: number;
  revenue: number;
}
