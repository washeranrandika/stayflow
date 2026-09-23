import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "StayFlow — Property Management System",
  description: "Multi-tenant Guest House & Hotel Property Management System. Manage rooms, reservations, check-ins, billing and staff in one place.",
  keywords: ["hotel management", "PMS", "guest house", "property management", "reservation system"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/brand-icon.jpg",
  },
  openGraph: {
    title: "StayFlow — Property Management System",
    description: "Manage your hotel or guest house efficiently with StayFlow PMS.",
    images: [{ url: "/logo.jpg", width: 1200, height: 630 }],
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster position="top-right" toastOptions={{
            style: {
              borderRadius: "10px",
              background: "#0f172a",
              color: "#f8fafc",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#0f172a" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#0f172a" } },
          }} />
        </Providers>
      </body>
    </html>
  );
}
