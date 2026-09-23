"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingsApi, staysApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Calendar, User, BedDouble, ArrowLeft, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import Link from "next/link";

export default function BookingDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: () => bookingsApi.get(id),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => bookingsApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setIsCancelOpen(false);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (stayData: any) => staysApi.checkIn(stayData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      router.push("/stays");
    },
  });

  const booking = data?.data?.data;

  if (isLoading) {
    return <div className="p-8 text-slate-500 animate-pulse">Loading booking details...</div>;
  }

  if (!booking) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Booking not found.</p>
        <Link href="/bookings" className="text-blue-600 font-semibold mt-2 inline-block">
          Back to Bookings
        </Link>
      </div>
    );
  }

  const handleQuickCheckIn = () => {
    checkInMutation.mutate({
      reservation_id: booking.id,
      property_id: booking.property_id,
      room_id: booking.room_id,
      primary_guest_id: booking.primary_guest_id,
      stay_type: booking.stay_type,
      expected_checkout: booking.expected_checkout_date,
      num_guests: booking.num_guests || 1,
    });
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    cancelMutation.mutate(cancelReason);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/bookings"
          className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{booking.reservation_number}</h1>
          <p className="text-sm text-slate-500">
            Created on {new Date(booking.created_at).toLocaleDateString()} via {booking.booking_source}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {booking.status === "CONFIRMED" && (
            <>
              <button
                onClick={() => setIsCancelOpen(true)}
                className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel Booking
              </button>
              <button
                onClick={handleQuickCheckIn}
                disabled={checkInMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{checkInMutation.isPending ? "Checking in..." : "Check-in Guest"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Reservation Information</span>
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                {booking.status}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Stay Type</span>
              <span className="font-semibold text-slate-800">{booking.stay_type}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Check-in Date</span>
              <span className="font-semibold text-slate-800">{booking.check_in_date}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Expected Checkout</span>
              <span className="font-semibold text-slate-800">{booking.expected_checkout_date}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Advance Deposit</span>
              <span className="font-semibold text-emerald-600">
                Rs. {Number(booking.advance_payment || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-purple-600" />
            <span>Guest & Room Details</span>
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Guest Name</span>
              <Link
                href={`/guests/${booking.primary_guest_id}`}
                className="font-bold text-blue-600 hover:underline"
              >
                {booking.guest?.full_name || "Primary Guest"}
              </Link>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Guest Phone</span>
              <span className="font-medium text-slate-800">{booking.guest?.phone || "—"}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Assigned Room</span>
              <span className="font-bold text-slate-900">
                Room {booking.room?.room_number || "Unassigned"}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Guests Count</span>
              <span className="font-medium text-slate-800">{booking.num_guests || 1} Person(s)</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-500">Special Notes</span>
              <span className="text-slate-600 italic">{booking.notes || "None"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {isCancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Cancel Reservation</h2>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to cancel booking {booking.reservation_number}?
            </p>
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for cancellation *</label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Guest requested cancellation via phone"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {cancelMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
