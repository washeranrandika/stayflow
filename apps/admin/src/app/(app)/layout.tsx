"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getAccessToken } from "@/lib/api-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getAccessToken() : null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (!token || isError) {
      router.push("/login");
    }
  }, [token, isError, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const user = data?.data?.data;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        userName={user?.full_name || "Loading..."}
        orgName={user?.organization_name || "StayFlow"}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
