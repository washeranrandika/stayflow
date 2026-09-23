"use client";
import { Shield, Check, X } from "lucide-react";

const PERMISSION_GROUPS = [
  {
    group: "Property & Inventory",
    permissions: [
      { key: "property.view", label: "View Properties", roles: ["OWNER", "MANAGER"] },
      { key: "property.update", label: "Update Property Settings", roles: ["OWNER", "MANAGER"] },
      { key: "room.view", label: "View Rooms & Availability", roles: ["OWNER", "MANAGER", "RECEPTIONIST", "HOUSEKEEPER"] },
      { key: "room.create", label: "Create Rooms & Room Types", roles: ["OWNER", "MANAGER"] },
      { key: "room.status.update", label: "Update Room Status", roles: ["OWNER", "MANAGER", "RECEPTIONIST", "HOUSEKEEPER"] },
    ],
  },
  {
    group: "Reservations & Stays",
    permissions: [
      { key: "booking.view", label: "View Bookings", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { key: "booking.create", label: "Create Bookings & Walk-ins", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { key: "stay.checkin", label: "Check-in Guests", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { key: "stay.checkout", label: "Checkout & Settle Stays", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { key: "guest.document.view", label: "View Guest ID Documents", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
    ],
  },
  {
    group: "Financials & Billing",
    permissions: [
      { key: "invoice.view", label: "View Invoices & Folios", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { key: "invoice.create", label: "Add Charges & Folio Items", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { key: "payment.create", label: "Record Payments", roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
      { key: "payment.refund", label: "Process Refunds", roles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    group: "Administration & Audit",
    permissions: [
      { key: "report.view", label: "Access Analytics & Reports", roles: ["OWNER", "MANAGER"] },
      { key: "staff.manage", label: "Manage Staff & Memberships", roles: ["OWNER", "MANAGER"] },
      { key: "audit.view", label: "View Immutable Audit Trail", roles: ["OWNER", "MANAGER"] },
    ],
  },
];

const ROLES = ["OWNER", "MANAGER", "RECEPTIONIST", "HOUSEKEEPER"];

export default function RolesPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Role-Based Access Control (RBAC)</h1>
        <p className="text-sm text-slate-500">
          Declarative system permissions matrix enforced across backend endpoints and UI routes.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
            <tr>
              <th className="px-6 py-4">Permission Name</th>
              {ROLES.map((role) => (
                <th key={role} className="px-4 py-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                    {role}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PERMISSION_GROUPS.map((group) => (
              <>
                <tr key={group.group} className="bg-slate-50/70">
                  <td colSpan={5} className="px-6 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {group.group}
                  </td>
                </tr>
                {group.permissions.map((perm) => (
                  <tr key={perm.key} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <p className="font-semibold text-slate-900">{perm.label}</p>
                      <p className="text-xs text-slate-400 font-mono">{perm.key}</p>
                    </td>
                    {ROLES.map((role) => {
                      const hasAccess = perm.roles.includes(role);
                      return (
                        <td key={role} className="px-4 py-3 text-center">
                          {hasAccess ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center mx-auto">
                              <X className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
