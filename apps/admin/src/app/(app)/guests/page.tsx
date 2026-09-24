"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guestsApi } from "@/lib/api";
import { validateGuestId, DecodedIdInfo } from "@/lib/idValidation";
import { useActiveProperty } from "@/hooks/useActiveProperty";
import Link from "next/link";
import {
  Loader2,
  Search,
  Users,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  Plus,
  X,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Building2,
} from "lucide-react";
import clsx from "clsx";

const ID_TYPES = [
  { key: "NATIONAL_ID", label: "National ID (NIC)" },
  { key: "PASSPORT", label: "Passport" },
  { key: "DRIVING_LICENSE", label: "Driving License" },
  { key: "OTHER", label: "Other ID" },
];

export default function GuestsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idType, setIdType] = useState("NATIONAL_ID");
  const [idNumber, setIdNumber] = useState("");
  const [nationality, setNationality] = useState("Sri Lankan");
  const [address, setAddress] = useState("");
  const [idValidation, setIdValidation] = useState<DecodedIdInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Debounce search effect
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Live ID Validation
  useEffect(() => {
    if (!idNumber.trim()) {
      setIdValidation(null);
      return;
    }
    const result = validateGuestId(idType, idNumber);
    setIdValidation(result);
  }, [idType, idNumber]);

  const { propertyIdParam, selectedProperty } = useActiveProperty();

  const { data: guestsData, isLoading } = useQuery({
    queryKey: ["guests", debouncedSearch, propertyIdParam],
    queryFn: () => guestsApi.list({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(propertyIdParam ? { property_id: propertyIdParam } : {}),
    }),
  });

  const guests = guestsData?.data?.data || [];

  // Create Guest Mutation
  const createGuestMutation = useMutation({
    mutationFn: (data: any) => guestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      setShowAddModal(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail?.message || err.response?.data?.detail || "Failed to create guest";
      setFormError(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setIdType("NATIONAL_ID");
    setIdNumber("");
    setNationality("Sri Lankan");
    setAddress("");
    setIdValidation(null);
    setFormError(null);
  };

  const handleCreateGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError("Guest full name is required.");
      return;
    }

    if (idNumber.trim() && idValidation && !idValidation.isValid) {
      setFormError(idValidation.errorMessage || "Please provide a valid ID number.");
      return;
    }

    const payload: any = {
      full_name: fullName.trim(),
    };
    if (phone.trim()) payload.phone = phone.trim();
    if (email.trim()) payload.email = email.trim();
    if (address.trim()) payload.address = address.trim();
    if (idValidation?.dob) payload.date_of_birth = idValidation.dob;

    const idTag = idNumber.trim()
      ? `[ID: ${idType} - ${idNumber.trim()}${idValidation?.gender ? ` | ${idValidation.gender}` : ""}]`
      : "";
    const natTag = nationality.trim() ? `[Nationality: ${nationality.trim()}]` : "";
    payload.notes = [idTag, natTag].filter(Boolean).join(" ");

    createGuestMutation.mutate(payload);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Guest Profiles & KYC {selectedProperty ? `— ${selectedProperty.name}` : "— All Properties"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Search guest history, manage profiles, and verify identity documents {selectedProperty ? `for ${selectedProperty.name}` : "across all properties"}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Guest</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex justify-end">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ID number, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading && !guestsData ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Guest Profile</th>
                  <th className="px-6 py-4 font-semibold">Contact Details</th>
                  <th className="px-6 py-4 font-semibold">Address / Notes</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No guests found</p>
                      {search && <p className="text-slate-400 text-sm mt-1">Try adjusting your search criteria</p>}
                    </td>
                  </tr>
                ) : (
                  guests.map((guest: any) => (
                    <tr key={guest.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                            {guest.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{guest.full_name}</span>
                            {guest.date_of_birth && (
                              <span className="text-xs text-slate-500">DOB: {guest.date_of_birth}</span>
                            )}
                            {guest.blacklisted && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wide">
                                <AlertTriangle className="w-3 h-3" />
                                Blacklisted
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {guest.email ? (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{guest.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">No email</span>
                          )}
                          {guest.phone ? (
                            <div className="flex items-center gap-2 text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{guest.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">No phone</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 max-w-xs">
                          {guest.address && (
                            <div className="flex items-start gap-1.5 text-slate-600 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <span className="truncate">{guest.address}</span>
                            </div>
                          )}
                          {guest.notes && (
                            <p className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100 truncate">
                              {guest.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/guests/${guest.id}`}
                          className="text-blue-600 font-medium hover:text-blue-700 text-sm hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Guest Modal with Live ID Validation ─────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Register New Guest</h3>
                  <p className="text-xs text-slate-500">ID validation and KYC auto-decode</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateGuest} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* ID Type Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">ID Document Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ID_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setIdType(t.key)}
                      className={clsx(
                        "px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-center",
                        idType === t.key
                          ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ID Number with Live Verification */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ID / Document Number</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder={idType === "NATIONAL_ID" ? "e.g. 981234567V or 199812345678" : "e.g. N1234567"}
                    className={clsx(
                      "pl-9 pr-9 py-2 w-full border rounded-lg text-sm uppercase focus:outline-none",
                      idValidation
                        ? idValidation.isValid
                          ? "border-emerald-400 bg-emerald-50/40 text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                          : "border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-500"
                        : "border-slate-300 focus:ring-2 focus:ring-blue-500"
                    )}
                  />
                  {idValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {idValidation.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                  )}
                </div>

                {/* Validation Error Message */}
                {idValidation && !idValidation.isValid && idValidation.errorMessage && (
                  <p className="text-xs text-rose-600 font-medium mt-1">⚠️ {idValidation.errorMessage}</p>
                )}

                {/* Decoded Info Box */}
                {idValidation && idValidation.isValid && idValidation.dob && (
                  <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-emerald-900">Verified NIC:</span>
                      <span className="text-emerald-800">🎂 {idValidation.dobFormatted}</span>
                    </div>
                    <div className="flex items-center gap-3 font-semibold text-emerald-900">
                      <span>{idValidation.gender === "Female" ? "👩 Female" : "👨 Male"}</span>
                      <span>⏳ {idValidation.age} yrs</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Kasun Fernando"
                  className="px-3 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Phone & Nationality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="px-3 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="Sri Lankan"
                    className="px-3 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@email.com"
                  className="px-3 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Postal Code"
                  className="px-3 py-2 w-full border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGuestMutation.isPending}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {createGuestMutation.isPending ? "Registering..." : "Register Guest"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
