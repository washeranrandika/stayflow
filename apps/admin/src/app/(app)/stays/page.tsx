"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { staysApi, billingApi, paymentsApi } from "@/lib/api";
import { Sparkles, BedDouble, Plus, LogOut, Clock, DollarSign, CheckCircle } from "lucide-react";
import Link from "next/link";

import { useActiveProperty } from "@/hooks/useActiveProperty";
import { Building2 } from "lucide-react";

export default function StaysPage() {
  const queryClient = useQueryClient();
  const { propertyIdParam, selectedProperty, properties, setProperty, selectedPropertyId } = useActiveProperty();

  // Modals
  const [selectedStay, setSelectedStay] = useState<any | null>(null);
  const [folioModalOpen, setFolioModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // Folio item form state
  const [category, setCategory] = useState("FOOD");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(500);

  // Checkout pricing & payment state
  const [checkoutDiscount, setCheckoutDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const { data, isLoading } = useQuery({
    queryKey: ["activeStays", propertyIdParam],
    queryFn: () => apiClient.get("/stays/active", { params: propertyIdParam ? { property_id: propertyIdParam } : {} }),
  });

  const { data: pricingData, isLoading: pricingLoading } = useQuery({
    queryKey: ["stayPricing", selectedStay?.id],
    queryFn: () => staysApi.getPricing(selectedStay?.id),
    enabled: !!selectedStay && checkoutModalOpen,
  });

  const activeStays = data?.data?.data || [];
  const pricing = pricingData?.data?.data;

  // Mutations
  const addChargeMutation = useMutation({
    mutationFn: (body: any) => billingApi.addFolioItem(selectedStay.folio_id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeStays"] });
      setFolioModalOpen(false);
      setDescription("");
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const checkoutRes = await staysApi.checkout(selectedStay.id, checkoutDiscount);
      const invoiceId = checkoutRes.data?.data?.invoice_id;
      if (invoiceId && pricing?.grand_total > 0) {
        await paymentsApi.create(invoiceId, {
          payment_method: paymentMethod,
          amount: pricing.grand_total - checkoutDiscount,
        });
      }
      return checkoutRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeStays"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCheckoutModalOpen(false);
      setSelectedStay(null);
    },
  });

  const handleAddFolioItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !selectedStay?.folio_id) return;
    addChargeMutation.mutate({
      category,
      description,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Active Stays & Folios {selectedProperty ? `— ${selectedProperty.name}` : ""}
          </h1>
          <p className="text-sm text-slate-500">
            Monitor ongoing guest stays, bill room service, and process final checkouts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {properties.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Property:</span>
              <select
                value={selectedPropertyId}
                onChange={(e) => setProperty(e.target.value)}
                className="text-sm font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-2"
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <Link
            href={`/check-in${propertyIdParam ? `?property_id=${propertyIdParam}` : ""}`}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Check-in</span>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-slate-500 animate-pulse">Loading active stays...</div>
      ) : activeStays.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">No active stays right now</h3>
          <p className="text-sm text-slate-500 mt-1">Check-in walk-in guests or reservations to populate this list.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeStays.map((stay: any) => (
            <div
              key={stay.id}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-sm">
                    Room {stay.room?.room_number || "—"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    Occupied
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-4">
                  {stay.primary_guest?.full_name || "Guest"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{stay.stay_type} Stay</p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Checked In</span>
                    <span>{new Date(stay.actual_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected Out</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(stay.expected_checkout).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Folio Charges</span>
                    <span className="font-bold text-slate-900">
                      Rs. {Number(stay.folio?.total || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedStay(stay);
                    setFolioModalOpen(true);
                  }}
                  className="flex-1 py-1.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  + Add Service
                </button>
                <button
                  onClick={() => {
                    setSelectedStay(stay);
                    setCheckoutModalOpen(true);
                  }}
                  className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Checkout</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Folio Item Modal */}
      {folioModalOpen && selectedStay && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Add Service Charge to Folio</h2>
            <p className="text-sm text-slate-500 mb-4">
              Add food, minibar, or laundry to Room {selectedStay.room?.room_number}.
            </p>
            <form onSubmit={handleAddFolioItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="FOOD">Food & Dining</option>
                  <option value="DRINK">Beverage</option>
                  <option value="MINIBAR">Minibar</option>
                  <option value="LAUNDRY">Laundry</option>
                  <option value="ROOM_SERVICE">Room Service</option>
                  <option value="OTHER">Other Service</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Club Sandwich & Cola"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (Rs.)</label>
                  <input
                    type="number"
                    min={0}
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 text-right">
                <span className="text-xs text-slate-500">Total charge: </span>
                <span className="font-bold text-slate-900">Rs. {(quantity * unitPrice).toLocaleString()}</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFolioModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addChargeMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {addChargeMutation.isPending ? "Adding..." : "Add to Folio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModalOpen && selectedStay && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl animate-in fade-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Checkout Room {selectedStay.room?.room_number}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Review duration, room charges, extra hours, and folio items.
            </p>

            {pricingLoading ? (
              <div className="py-8 text-center text-slate-500 animate-pulse">Calculating final bill...</div>
            ) : pricing ? (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room Base Charge</span>
                    <span className="font-medium text-slate-800">Rs. {pricing.room_charge?.toLocaleString()}</span>
                  </div>
                  {pricing.extra_hour_charge > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Overtime Charge</span>
                      <span className="font-medium">Rs. {pricing.extra_hour_charge?.toLocaleString()}</span>
                    </div>
                  )}
                  {pricing.services_total > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Services & Extras</span>
                      <span className="font-medium text-slate-800">Rs. {pricing.services_total?.toLocaleString()}</span>
                    </div>
                  )}
                  {pricing.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax</span>
                      <span className="font-medium text-slate-800">Rs. {pricing.tax?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
                    <span>Grand Total</span>
                    <span>Rs. {pricing.grand_total?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Receive Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Credit/Debit Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="QR">QR Payment</option>
                  </select>
                </div>

                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>
                    Completing checkout will finalize the invoice, set Room {selectedStay.room?.room_number} to <strong>CLEANING</strong>, and notify housekeeping.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCheckoutModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => checkoutMutation.mutate()}
                    disabled={checkoutMutation.isPending}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {checkoutMutation.isPending ? "Finalizing..." : "Confirm & Checkout"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
