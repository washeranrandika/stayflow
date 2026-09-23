"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guestsApi } from "@/lib/api";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { User, Phone, Mail, FileText, ArrowLeft, Upload, CheckCircle2, XCircle, Eye, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function GuestDetailPage() {
  const { id } = useParams() as { id: string };
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState("NATIONAL_ID");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewDocUrl, setViewDocUrl] = useState<string | null>(null);

  const { data: guestData, isLoading } = useQuery({
    queryKey: ["guest", id],
    queryFn: () => guestsApi.get(id),
  });

  const { data: historyData } = useQuery({
    queryKey: ["guestHistory", id],
    queryFn: () => guestsApi.history(id),
  });

  const guest = guestData?.data?.data;
  const history = historyData?.data?.data || { reservations: [], stays: [] };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("guest_id", id);
      formData.append("document_type", docType);
      formData.append("file", selectedFile);

      await apiClient.post("/identity/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      queryClient.invalidateQueries({ queryKey: ["guest", id] });
      setUploadOpen(false);
      setSelectedFile(null);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (docId: string) => {
    try {
      const res = await apiClient.get(`/identity/documents/${docId}/url`);
      const url = res.data?.data?.signed_url;
      if (url) {
        window.open(url, "_blank");
      }
    } catch (err) {
      alert("Unable to fetch document signed URL");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-slate-500 animate-pulse">Loading guest profile...</div>;
  }

  if (!guest) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Guest not found.</p>
        <Link href="/guests" className="text-blue-600 font-semibold mt-2 inline-block">
          Back to Guests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/guests"
          className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{guest.full_name}</h1>
          <p className="text-sm text-slate-500">Guest Profile & Verified Records</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Upload ID Document</span>
          </button>
        </div>
      </div>

      {/* Profile & Identity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <span>Personal Information</span>
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{guest.phone || "Not provided"}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{guest.email || "Not provided"}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Address</p>
              <p className="text-slate-700 mt-0.5">{guest.address || "No address recorded"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Preferred Language</p>
              <p className="font-medium text-slate-800 mt-0.5">{guest.preferred_language || "English"}</p>
            </div>
          </div>
        </div>

        {/* ID Documents & Verification */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Identity Verification & Documents</span>
            </h2>
            <span className="text-xs text-slate-400">Private & encrypted</span>
          </div>

          {guest.documents && guest.documents.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {guest.documents.map((doc: any) => (
                <div key={doc.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{doc.document_type}</p>
                    <p className="text-xs text-slate-500">
                      Doc No: {doc.document_number || "Pending OCR"} • Uploaded {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                    {doc.ocr_confidence && (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">
                        OCR Confidence: {(doc.ocr_confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleViewDocument(doc.id)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View (Signed URL)</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm">No identity documents uploaded yet.</p>
              <button
                onClick={() => setUploadOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:underline mt-1 inline-block"
              >
                + Upload National ID / Passport
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Past Stays & Reservations */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Stay History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Stay Type</th>
                <th className="px-4 py-3">Check-In</th>
                <th className="px-4 py-3">Checkout</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.stays.map((s: any) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.stay_type}</td>
                  <td className="px-4 py-3">{new Date(s.actual_check_in).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {s.actual_checkout ? new Date(s.actual_checkout).toLocaleString() : "Active"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                      {s.is_completed ? "Completed" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
              {history.stays.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No past stays recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Document Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Upload ID Document</h2>
            <p className="text-sm text-slate-500 mb-4">
              Stored securely in private object storage. OCR will assist with field extraction.
            </p>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NATIONAL_ID">National ID (NIC)</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select File (JPG, PNG, PDF) *</label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {uploading ? "Processing OCR..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
