"use client";

import { useEffect } from "react";

const LEGACY_KEYS = ["fate_history", "fate-report-v7-", "fate-duo-report-v7-"];

export default function PrivacyCleanup() {
  useEffect(() => {
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key && LEGACY_KEYS.some((prefix) => key === prefix || key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Privacy mode can disable localStorage; there is nothing to clear then.
    }
  }, []);

  return null;
}
