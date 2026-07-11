"use client";

import { useState } from "react";
import type { ProductSku } from "@/lib/entitlements";

export default function CheckoutButton({
  sku,
  state,
  returnTo,
  children,
  className = "fb-cta",
}: {
  sku: ProductSku;
  state: string;
  returnTo: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const beginCheckout = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, state, returnTo }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "无法创建支付订单。");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : "无法创建支付订单。");
      setBusy(false);
    }
  };

  return <>
    <button type="button" className={className} onClick={beginCheckout} disabled={busy}>
      {busy ? "正在打开支付页…" : children}
    </button>
    {error && <span className="fb-unlock-err" role="alert">{error}</span>}
  </>;
}
