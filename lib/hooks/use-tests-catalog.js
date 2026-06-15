"use client";

import { useEffect, useState } from "react";

export function useTestsCatalog() {
  const [testsCatalog, setTestsCatalog] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    fetch(`${base}/product-settings/tests?per_page=500`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
            ? result.data
            : [];
        setTestsCatalog(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return testsCatalog;
}
