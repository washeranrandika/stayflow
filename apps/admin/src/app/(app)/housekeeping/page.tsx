"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { housekeepingApi } from "@/lib/api";
import { ClipboardList, CheckCircle2, Clock, PlayCircle, AlertCircle } from "lucide-react";
import clsx from "clsx";

import { useActiveProperty } from "@/hooks/useActiveProperty";
import { Building2 } from "lucide-react";

export default function HousekeepingPage() {
  const queryClient = useQueryClient();
  const { propertyIdParam, selectedProperty, properties, setProperty, selectedPropertyId } = useActiveProperty();
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["housekeepingTasks", filterStatus, propertyIdParam],
    queryFn: () =>
      housekeepingApi.listTasks({
        ...(filterStatus !== "ALL" ? { status: filterStatus } : {}),
        ...(propertyIdParam ? { property_id: propertyIdParam } : {}),
      }),
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      housekeepingApi.updateTask(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["housekeepingTasks"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const tasks = data?.data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Housekeeping & Room Turnaround {selectedProperty ? `— ${selectedProperty.name}` : ""}
          </h1>
          <p className="text-sm text-slate-500">
            Dispatch cleaning tasks, track turnover status, and mark cleaned rooms available.
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
          <div className="flex items-center gap-2">
            {["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  filterStatus === st
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dispatched At</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading housekeeping tasks...</td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No cleaning tasks found for selected filter.
                  </td>
                </tr>
              ) : (
                tasks.map((task: any) => (
                  <tr key={task.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      Room {task.room?.room_number || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-xs font-semibold",
                        task.priority === "URGENT" ? "bg-rose-50 text-rose-700" :
                        task.priority === "HIGH" ? "bg-amber-50 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                        task.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" :
                        task.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" :
                        "bg-amber-50 text-amber-700"
                      )}>
                        {task.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{task.notes || "Turnaround cleaning"}</td>
                    <td className="px-4 py-3 text-right">
                      {task.status === "PENDING" && (
                        <button
                          onClick={() => updateMutation.mutate({ id: task.id, status: "IN_PROGRESS" })}
                          disabled={updateMutation.isPending}
                          className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Start</span>
                        </button>
                      )}
                      {task.status === "IN_PROGRESS" && (
                        <button
                          onClick={() => updateMutation.mutate({ id: task.id, status: "COMPLETED" })}
                          disabled={updateMutation.isPending}
                          className="px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Cleaned (Available)</span>
                        </button>
                      )}
                      {task.status === "COMPLETED" && (
                        <span className="text-xs text-emerald-600 font-medium flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ready</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
