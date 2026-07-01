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

const AUTH_GUARD_SCRIPT = `
(function () {
  try {
    var path = window.location.pathname;
    var publicPrefixes = ["/login", "/register", "/forgot-password", "/reset-password"];
    if (publicPrefixes.some(function (prefix) { return path.indexOf(prefix) === 0; })) return;
    if (
      /\\/ticketing\\/(?:in|outgoing)\\/[^/]+\\/print\\/?$/.test(path) ||
      /^\\/reports\\/preview\\/[^/]+\\/?$/.test(path) ||
      /^\\/fumigation\\/(?:certificates|records)\\/[^/]+\\/print\\/?$/.test(path)
    ) {
      return;
    }
    var token = localStorage.getItem("authToken");
    var flag = localStorage.getItem("isAuthenticated");
    var raw = localStorage.getItem("authPayload");
    var user = null;
    if (raw) {
      try {
        user = JSON.parse(raw).user;
      } catch (e) {}
    }
    if (!token || flag !== "true" || !user) {
      window.location.replace("/login");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: AUTH_GUARD_SCRIPT }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
