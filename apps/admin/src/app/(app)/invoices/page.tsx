"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { FileText, CheckCircle2, Clock, Eye, DollarSign } from "lucide-react";

import { useActiveProperty } from "@/hooks/useActiveProperty";
import { Building2 } from "lucide-react";

export default function InvoicesPage() {
  const { propertyIdParam, selectedProperty } = useActiveProperty();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", propertyIdParam],
    queryFn: () => apiClient.get("/billing/invoices", { params: propertyIdParam ? { property_id: propertyIdParam } : {} }),
  });

  const invoices = data?.data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Invoices & Billing {selectedProperty ? `— ${selectedProperty.name}` : "— All Properties"}
          </h1>
          <p className="text-sm text-slate-500">
            Historical finalized invoices, snapshot charges, and payment settlements {selectedProperty ? `for ${selectedProperty.name}` : "across all properties"}.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Invoice Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Room Charge</th>
                <th className="px-4 py-3">Services</th>
                <th className="px-4 py-3">Grand Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading invoices...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No invoices recorded yet.</td>
                </tr>
              ) : (
                invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">Rs. {Number(inv.room_charge || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">Rs. {Number(inv.services_total || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">Rs. {Number(inv.grand_total || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                        {inv.is_finalized ? "Finalized" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 inline-flex items-center gap-1 text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl animate-in fade-in">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedInvoice.invoice_number}</h2>
                <p className="text-xs text-slate-500">
                  Finalized on {new Date(selectedInvoice.created_at).toLocaleString()}
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                Finalized
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Room Charge</span>
                <span className="font-semibold text-slate-800">
                  Rs. {Number(selectedInvoice.room_charge || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Services & Extras</span>
                <span className="font-semibold text-slate-800">
                  Rs. {Number(selectedInvoice.services_total || 0).toLocaleString()}
                </span>
              </div>
              {selectedInvoice.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Taxes</span>
                  <span className="font-semibold text-slate-800">
                    Rs. {Number(selectedInvoice.tax || 0).toLocaleString()}
                  </span>
                </div>
              )}
              {selectedInvoice.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount Applied</span>
                  <span className="font-semibold">
                    - Rs. {Number(selectedInvoice.discount || 0).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-base">
                <span>Grand Total</span>
                <span>Rs. {Number(selectedInvoice.grand_total || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
