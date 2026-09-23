"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orgApi, propertiesApi } from "@/lib/api";
import { useActiveProperty } from "@/hooks/useActiveProperty";
import { Shield, Plus, Mail, User, CheckCircle2, Building2, Edit2, X, Lock, Search } from "lucide-react";
import toast from "react-hot-toast";

export default function StaffPage() {
  const queryClient = useQueryClient();
  const { selectedPropertyId, setProperty: setGlobalPropertyId, properties } = useActiveProperty();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMember, setEditMember] = useState<any | null>(null);

  // Form State
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("RECEPTIONIST");
  const [propertyId, setPropertyId] = useState<string>("all");

  // Edit Form State
  const [editRole, setEditRole] = useState("RECEPTIONIST");
  const [editPropertyId, setEditPropertyId] = useState<string>("all");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  const { data: membersData, isLoading } = useQuery({
    queryKey: ["orgMembers"],
    queryFn: () => orgApi.members(),
  });

  const members = membersData?.data?.data || [];

  const inviteMutation = useMutation({
    mutationFn: (body: any) => orgApi.inviteMember(body),
    onSuccess: () => {
      toast.success("Staff member invited successfully!");
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      setIsModalOpen(false);
      setEmail("");
      setFullName("");
      setPassword("");
      setPropertyId("all");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail?.message || "Failed to invite staff member");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ memberId, body }: { memberId: string; body: any }) =>
      orgApi.updateMember(memberId, body),
    onSuccess: () => {
      toast.success("Staff member updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
      setEditMember(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail?.message || "Failed to update staff member");
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !password.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    inviteMutation.mutate({
      email: email.trim(),
      full_name: fullName.trim(),
      password: password.trim(),
      role,
      property_id: propertyId !== "all" ? propertyId : null,
    });
  };

  const handleOpenEdit = (m: any) => {
    setEditMember(m);
    setEditRole(m.role);
    setEditPropertyId(m.property_id || "all");
    setEditIsActive(m.is_active !== false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    updateMutation.mutate({
      memberId: editMember.member_id,
      body: {
        role: editRole,
        property_id: editPropertyId !== "all" ? editPropertyId : null,
        is_active: editIsActive,
      },
    });
  };

  const filteredMembers = members.filter((m: any) => {
    // 1. Property filter (from top header filter or page filter)
    if (selectedPropertyId && selectedPropertyId !== "all") {
      if (m.property_id !== selectedPropertyId) return false;
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.full_name?.toLowerCase().includes(q);
      const matchEmail = m.email?.toLowerCase().includes(q);
      const matchRole = m.role?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchRole) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff & Member Property Assignment</h1>
          <p className="text-sm text-slate-500">
            Assign managers and front desk staff to specific properties or grant organization-wide access.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 shadow-sm"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Invite Staff</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Staff Member</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Assigned Property</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading staff members...</td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No staff members found matching this property.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m: any) => (
                  <tr key={m.member_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                        {m.full_name ? m.full_name.charAt(0).toUpperCase() : "S"}
                      </div>
                      <span>{m.full_name || "Staff Member"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>{m.property_name || "All Properties (Owner)"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Scope</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── INVITE MODAL ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Invite Staff Member</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 mb-4">
              Create login credentials and assign this team member to an operational property branch.
            </p>
            <form onSubmit={handleInvite} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasun Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="manager.galle@stayflow.lk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="MANAGER">Branch Manager (Operational Control & Reports)</option>
                  <option value="RECEPTIONIST">Receptionist (Front Desk Check-in & Rooms)</option>
                  <option value="HOUSEKEEPER">Housekeeper (Cleaning & Turnaround)</option>
                  <option value="OWNER">Owner (Organization-Wide Admin)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Property Branch</label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="all">🌐 All Properties (Unrestricted Access)</option>
                  {properties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      📍 {p.name} {p.city ? `(${p.city})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Property-scoped staff will automatically have their mobile & admin views locked to their assigned property.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {inviteMutation.isPending ? "Creating..." : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ───────────────────────────────────────────────────── */}
      {editMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Member Assignment</h2>
                <p className="text-xs text-slate-500">{editMember.full_name} ({editMember.email})</p>
              </div>
              <button
                onClick={() => setEditMember(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="MANAGER">Branch Manager</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="HOUSEKEEPER">Housekeeper</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Property Branch</label>
                <select
                  value={editPropertyId}
                  onChange={(e) => setEditPropertyId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="all">🌐 All Properties (Unrestricted)</option>
                  {properties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      📍 {p.name} {p.city ? `(${p.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="isActiveCheck" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Account Active
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditMember(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Update Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
