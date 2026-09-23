"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { paymentsApi } from "@/lib/api";
import { CreditCard, DollarSign, ArrowDownLeft, RotateCcw, CheckCircle } from "lucide-react";

import { useActiveProperty } from "@/hooks/useActiveProperty";
import { Building2 } from "lucide-react";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { propertyIdParam, selectedProperty, properties, setProperty, selectedPropertyId } = useActiveProperty();
  const [refundPayment, setRefundPayment] = useState<any | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["allPayments", propertyIdParam],
    queryFn: () => apiClient.get("/payments", { params: propertyIdParam ? { property_id: propertyIdParam } : {} }),
  });

  const payments = data?.data?.data || [];

  const refundMutation = useMutation({
    mutationFn: (body: any) => paymentsApi.refund(refundPayment.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      setRefundPayment(null);
      setRefundAmount(0);
      setRefundReason("");
    },
  });

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundReason.trim() || refundAmount <= 0) return;
    refundMutation.mutate({
      payment_id: refundPayment.id,
      amount: Number(refundAmount),
      reason: refundReason,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Payment Transactions {selectedProperty ? `— ${selectedProperty.name}` : ""}
          </h1>
          <p className="text-sm text-slate-500">
            Complete ledger of received payments, settlement methods, and customer refunds.
          </p>
        </div>
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
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading payments...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No payment transactions recorded yet.</td>
                </tr>
              ) : (
                payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">{p.payment_method}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-600">
                      Rs. {Number(p.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{p.reference || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setRefundPayment(p);
                          setRefundAmount(Number(p.amount));
                        }}
                        className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Refund</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {refundPayment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Process Payment Refund</h2>
            <p className="text-sm text-slate-500 mb-4">
              Original Payment: <strong>Rs. {Number(refundPayment.amount).toLocaleString()}</strong> ({refundPayment.payment_method})
            </p>
            <form onSubmit={handleRefundSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={Number(refundPayment.amount)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Refund *</label>
                <textarea
                  required
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Overcharged deposit adjustment"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRefundPayment(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {refundMutation.isPending ? "Processing..." : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
