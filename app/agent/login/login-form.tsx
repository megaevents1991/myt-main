"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function PartnerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/partner-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "ההתחברות נכשלה");
        return;
      }
      // `next` comes from our own middleware redirect, but it arrives via the
      // URL — only ever follow a same-site path, never an absolute URL.
      const next = searchParams.get("next");
      const target = next && next.startsWith("/agent") ? next : "/agent";
      router.replace(target);
      router.refresh();
    } catch {
      setError("אירעה שגיאה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" dir="rtl">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
          dir="ltr"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          סיסמה
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
          dir="ltr"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-main px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {busy ? "מתחבר..." : "כניסה"}
      </button>

      <p className="text-xs text-gray-500">
        האזור הזה מיועד לסוכנים ולמשפיענים. אין לכם גישה? פנו אלינו.
      </p>
    </form>
  );
}
