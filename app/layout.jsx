import { Geist, Geist_Mono } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Packing ERP",
  description: "Operations ERP for scheduling, ticketing, transactions, and fumigation.",
};

// This is an authenticated, fully client-rendered ERP — there's no static/SEO
// benefit to prerendering, and shared hooks use useSearchParams (which otherwise
// requires a Suspense boundary on every page). Render all routes dynamically.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
