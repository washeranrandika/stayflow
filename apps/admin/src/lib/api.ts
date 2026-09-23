import { apiClient } from "@/lib/api-client";

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post("/auth/login", { email, password }),
  logout: (refreshToken: string) =>
    apiClient.post("/auth/logout", { refresh_token: refreshToken }),
  me: () => apiClient.get("/users/me"),
};

// Properties
export const propertiesApi = {
  list: () => apiClient.get("/properties"),
  get: (id: string) => apiClient.get(`/properties/${id}`),
  create: (data: any) => apiClient.post("/properties", data),
  update: (id: string, data: any) => apiClient.patch(`/properties/${id}`, data),
};

// Rooms
export const roomsApi = {
  listByProperty: (propertyId: string, status?: string) =>
    apiClient.get(`/rooms/by-property/${propertyId}`, { params: { status } }),
  get: (id: string) => apiClient.get(`/rooms/${id}`),
  create: (data: any) => apiClient.post("/rooms", data),
  updateStatus: (id: string, status: string, notes?: string) =>
    apiClient.patch(`/rooms/${id}/status`, { status, notes }),
};

// Room Types
export const roomTypesApi = {
  listByProperty: (propertyId: string) =>
    apiClient.get(`/room-types/by-property/${propertyId}`),
  get: (id: string) => apiClient.get(`/room-types/${id}`),
  create: (data: any) => apiClient.post("/room-types", data),
  update: (id: string, data: any) => apiClient.patch(`/room-types/${id}`, data),
};

// Guests
export const guestsApi = {
  list: (params?: { search?: string; page?: number; page_size?: number }) =>
    apiClient.get("/guests", { params }),
  get: (id: string) => apiClient.get(`/guests/${id}`),
  create: (data: any) => apiClient.post("/guests", data),
  update: (id: string, data: any) => apiClient.patch(`/guests/${id}`, data),
  history: (id: string) => apiClient.get(`/guests/${id}/history`),
};

// Reservations / Bookings
export const bookingsApi = {
  list: (params?: any) => apiClient.get("/bookings", { params }),
  get: (id: string) => apiClient.get(`/bookings/${id}`),
  create: (data: any) => apiClient.post("/bookings", data),
  cancel: (id: string, reason: string) =>
    apiClient.post(`/bookings/${id}/cancel`, { reason }),
};

// Stays
export const staysApi = {
  checkIn: (data: any) => apiClient.post("/stays/check-in", data),
  get: (id: string) => apiClient.get(`/stays/${id}`),
  getPricing: (id: string) => apiClient.get(`/stays/${id}/pricing`),
  checkout: (id: string, discount?: number) =>
    apiClient.post(`/stays/${id}/checkout`, { discount: discount || 0 }),
};

// Billing
export const billingApi = {
  getFolio: (folioId: string) => apiClient.get(`/billing/folios/${folioId}`),
  addFolioItem: (folioId: string, data: any) =>
    apiClient.post(`/billing/folios/${folioId}/items`, data),
  getInvoice: (invoiceId: string) => apiClient.get(`/billing/invoices/${invoiceId}`),
};

// Payments
export const paymentsApi = {
  list: (invoiceId: string) => apiClient.get(`/payments/invoices/${invoiceId}/payments`),
  create: (invoiceId: string, data: any) =>
    apiClient.post(`/payments/invoices/${invoiceId}/payments`, data),
  refund: (paymentId: string, data: any) =>
    apiClient.post(`/payments/${paymentId}/refund`, data),
};

// Services
export const servicesApi = {
  listByProperty: (propertyId: string) =>
    apiClient.get(`/services/by-property/${propertyId}`),
  create: (data: any) => apiClient.post("/services", data),
  addOrder: (data: any) => apiClient.post("/services/orders", data),
};

// Housekeeping
export const housekeepingApi = {
  listTasks: (params?: any) => apiClient.get("/housekeeping/tasks", { params }),
  updateTask: (id: string, data: any) =>
    apiClient.patch(`/housekeeping/tasks/${id}`, data),
};

// Reports
export const reportsApi = {
  revenue: (params: any) => apiClient.get("/reports/revenue", { params }),
  occupancy: (params: any) => apiClient.get("/reports/occupancy", { params }),
  payments: (params: any) => apiClient.get("/reports/payments", { params }),
  dashboard: (propertyId?: string) =>
    apiClient.get("/reports/dashboard", { params: { property_id: propertyId } }),
};

// Audit logs
export const auditApi = {
  list: (params?: any) => apiClient.get("/audit", { params }),
};

// Organization
export const orgApi = {
  get: () => apiClient.get("/organizations/me"),
  members: () => apiClient.get("/organizations/members"),
  inviteMember: (data: any) => apiClient.post("/organizations/members", data),
};
