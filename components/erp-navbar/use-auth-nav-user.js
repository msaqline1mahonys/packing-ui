"use client";

import { useEffect, useState } from "react";

import { mapAuthPayloadToNavUser, readAuthPayload } from "@/lib/auth-session";

export function useAuthNavUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const sync = () => {
      setUser(mapAuthPayloadToNavUser(readAuthPayload()));
    };
    sync();
    window.addEventListener("auth-session-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-session-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return user;
}
