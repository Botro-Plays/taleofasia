"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: any;
    try {
      const stored = localStorage.getItem("toa_cookie_consent");
      if (!stored) timer = setTimeout(() => setVisible(true), 0);
    } catch {
      timer = setTimeout(() => setVisible(true), 0);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  if (!visible) return null;

  const persist = (data: Record<string, any>) => {
    try {
      localStorage.setItem("toa_cookie_consent", JSON.stringify({
        ...data,
        ts: Date.now(),
      }));
      // 365 days
      document.cookie = `toa_consent=${data.accepted ? "1" : "0"}; Max-Age=31536000; Path=/`;
    } catch {}
  };

  const onAccept = () => {
    persist({ accepted: true, essential: true, analytics: false, marketing: false });
    setVisible(false);
  };

  const onDecline = () => {
    persist({ accepted: false, essential: true, analytics: false, marketing: false });
    setVisible(false);
  };

  return (
    <div className="fixed bottom-[11.5rem] max-[640px]:bottom-[16.5rem] left-4 max-[640px]:left-1/2 max-[640px]:-translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md max-[640px]:max-w-3xl">
      <div className="metallic-card border-2 border-[var(--color-dark-steel)] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="text-sm text-slate-300 leading-relaxed">
          We use essential cookies to make our site work and optional cookies to improve your experience. 
          By clicking <span className="text-[var(--color-royal-gold)] font-semibold">Accept</span>, you consent to cookies as described in our {" "}
          <Link href="/privacy-policy#cookies" className="text-[var(--color-glowing-cyan)] hover:underline">Privacy Policy</Link>.
        </div>
        <div className="flex flex-col gap-2 ml-auto w-full sm:w-auto">
          <button onClick={onDecline} className="px-4 py-2 rounded border border-[var(--color-dark-steel)] text-slate-200 hover:bg-white/5 transition-colors text-sm font-semibold">
            Decline non-essential
          </button>
          <button onClick={onAccept} className="glow-button px-4 py-2 text-sm font-semibold">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
