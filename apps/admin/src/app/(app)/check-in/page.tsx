"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { staysApi, roomsApi, guestsApi, propertiesApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { BedDouble, UserPlus, Clock, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function CheckInPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  
  // Form state
  const [stayType, setStayType] = useState("OVERNIGHT");
  const [numGuests, setNumGuests] = useState(1);
  const [expectedCheckout, setExpectedCheckout] = useState("");

  const { data: propsData } = useQuery({ queryKey: ["properties"], queryFn: () => propertiesApi.list() });
  const propertyId = propsData?.data?.data?.[0]?.id;

  const { data: roomsData } = useQuery({
    queryKey: ["rooms", propertyId, "AVAILABLE"],
    queryFn: () => roomsApi.listByProperty(propertyId as string, "AVAILABLE"),
    enabled: !!propertyId,
  });

  const { data: guestsData } = useQuery({
    queryKey: ["guests"],
    queryFn: () => guestsApi.list(),
  });

  const checkInMutation = useMutation({
    mutationFn: (data: any) => staysApi.checkIn(data),
    onSuccess: () => {
      toast.success("Check-in successful");
      router.push("/dashboard");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || "Check-in failed");
    },
  });

  const handleCheckIn = () => {
    if (!selectedRoom || !selectedGuest || !expectedCheckout) {
      toast.error("Please complete all fields");
      return;
    }
    
    checkInMutation.mutate({
      property_id: propertyId,
      room_id: selectedRoom.id,
      primary_guest_id: selectedGuest.id,
      stay_type: stayType,
      num_guests: numGuests,
      expected_checkout: new Date(expectedCheckout).toISOString(),
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Check-in</h1>
        <p className="text-slate-500 text-sm mt-1">Walk-in guest registration</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-8">
        {[
          { num: 1, label: "Select Room", icon: BedDouble },
          { num: 2, label: "Guest Details", icon: UserPlus },
          { num: 3, label: "Stay Info", icon: Clock },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${step >= s.num ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400'}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`ml-3 text-sm font-medium ${step >= s.num ? 'text-slate-900' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {i < 2 && <div className={`w-16 h-0.5 mx-4 ${step > s.num ? 'bg-blue-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Available Rooms</h2>
            <div className="grid grid-cols-3 gap-4">
              {roomsData?.data?.data?.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoom(r)}
                  className={`p-4 rounded-lg border text-left ${selectedRoom?.id === r.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <p className="font-bold text-lg">Room {r.room_number}</p>
                  <p className="text-sm text-slate-500">{r.room_type.name}</p>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <button 
                disabled={!selectedRoom}
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Select Guest</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {guestsData?.data?.data?.items?.map((g: any) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGuest(g)}
                  className={`w-full p-3 text-left rounded-md flex justify-between items-center ${selectedGuest?.id === g.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}`}
                >
                  <div>
                    <p className="font-medium">{g.full_name}</p>
                    <p className="text-xs text-slate-500">{g.phone || g.email}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-2 border border-slate-300 rounded-lg">Back</button>
              <button 
                disabled={!selectedGuest}
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Stay Information</h2>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Stay Type</label>
                <select className="w-full p-2 border rounded-md" value={stayType} onChange={(e) => setStayType(e.target.value)}>
                  <option value="HOURLY">Hourly (Short stay)</option>
                  <option value="DAY_USE">Day Use</option>
                  <option value="OVERNIGHT">Overnight</option>
                  <option value="DAILY">Daily (Multiple nights)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Number of Guests</label>
                <input type="number" min="1" max={selectedRoom?.max_guests || 4} className="w-full p-2 border rounded-md" value={numGuests} onChange={(e) => setNumGuests(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expected Checkout</label>
                <input type="datetime-local" className="w-full p-2 border rounded-md" value={expectedCheckout} onChange={(e) => setExpectedCheckout(e.target.value)} />
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-2 border border-slate-300 rounded-lg">Back</button>
              <button 
                disabled={checkInMutation.isPending || !expectedCheckout}
                onClick={handleCheckIn}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {checkInMutation.isPending ? "Checking in..." : "Complete Check-in"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
