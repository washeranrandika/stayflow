"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/api-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = getAccessToken();
    setToken(t);
    setMounted(true);
    if (!t) {
      router.push("/login");
    }
  }, [router]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
    enabled: mounted && !!token,
    retry: false,
  });

  useEffect(() => {
    if (mounted && (isError || !token)) {
      router.push("/login");
    }
  }, [isError, token, mounted, router]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const user = data?.data?.data;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        userName={user?.full_name || "Loading..."}
        orgName={user?.organization_name || "StayFlow"}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header userName={user?.full_name || "Staff"} userRole={user?.role} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
