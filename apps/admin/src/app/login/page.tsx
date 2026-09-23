"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { setTokens } from "@/lib/api-client";
import toast from "react-hot-toast";
import { Lock, Mail, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const FEATURES = [
  "Real-time room availability & status board",
  "Walk-in check-in in under 30 seconds",
  "Automatic invoicing & payment tracking",
  "Housekeeping task management",
  "Multi-property & multi-staff support",
  "Revenue reports & occupancy analytics",
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: LoginForm) => authApi.login(email, password),
    onSuccess: (res) => {
      const { tokens } = res.data.data;
      setTokens(tokens.access_token, tokens.refresh_token);
      toast.success("Welcome back!");
      router.push("/dashboard");
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error?.message || "Invalid credentials";
      toast.error(msg);
    },
  });

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — Branding ──────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #2563eb, transparent)" }} />
        <div className="absolute -bottom-24 -right-24 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #0ea5e9, transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #2563eb, transparent)" }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }} />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <Image src="/brand-icon.jpg" alt="StayFlow" width={40} height={40} className="rounded-xl" />
            <div>
              <span className="text-white font-bold text-xl tracking-tight">StayFlow</span>
              <span className="block text-blue-400 text-xs font-medium tracking-widest uppercase">Property Management</span>
            </div>
          </div>

          {/* Hero text */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-6 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Trusted by 500+ properties
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight mb-6">
              Your front desk,
              <br />
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(90deg, #60a5fa, #38bdf8)" }}>
                supercharged.
              </span>
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed mb-10">
              Manage check-ins, track rooms, automate billing, and run your property
              with complete confidence — from any device.
            </p>

            {/* Feature list */}
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-slate-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom stats */}
          <div className="flex items-center gap-8 pt-8 border-t border-slate-700/50">
            {[
              { val: "500+", label: "Properties" },
              { val: "50k+", label: "Check-ins/month" },
              { val: "99.9%", label: "Uptime" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Sign In Form ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-slate-50">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <Image src="/brand-icon.jpg" alt="StayFlow" width={36} height={36} className="rounded-xl" />
          <span className="text-slate-900 font-bold text-xl tracking-tight">StayFlow</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
            <p className="text-slate-500 text-sm">Enter your credentials to access the dashboard.</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
            <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))} className="space-y-5">

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                    placeholder="you@property.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <span>⚠</span> {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                    className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <span>⚠</span> {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: loginMutation.isPending
                    ? "#93c5fd"
                    : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  boxShadow: loginMutation.isPending ? "none" : "0 4px 14px rgba(37,99,235,0.35)",
                }}
              >
                {loginMutation.isPending ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Demo credentials */}
          <div className="mt-5 p-4 bg-white rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Demo Access</p>
            <div className="space-y-1.5 text-sm text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Owner</span>
                <span className="font-mono font-medium">owner@stayflow.demo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Manager</span>
                <span className="font-mono font-medium">manager@stayflow.demo</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-1.5">
                <span className="text-slate-400">Password</span>
                <span className="font-mono font-medium text-blue-600">Demo@12345!</span>
              </div>
            </div>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            © {new Date().getFullYear()} StayFlow. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
