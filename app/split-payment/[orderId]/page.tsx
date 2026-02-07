"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Copy, CreditCard, Link2, Loader2, Plus, Trash2, XCircle } from "lucide-react";

type SplitPaymentStatus = "not_started" | "pending" | "authorized" | "failed";

type SplitPaymentCard = {
  id: string;
  amount_agorot: number;
  status: SplitPaymentStatus;
  tx_id?: string;
  link_token?: string;
  last_error?: string;
  updated_at: string;
};

type SplitPaymentStateV1 = {
  version: 1;
  mode: "split";
  currency: "ILS";
  total_agorot: number;
  min_amount_agorot: number;
  min_cards: number;
  base_max_cards: number;
  failure_max_cards: number;
  promo_code: string;
  cards: SplitPaymentCard[];
};

type UpdateAction =
  | { type: "set_amount"; paymentId: string; amount_agorot: number }
  | { type: "split_even" }
  | { type: "add_card" }
  | { type: "remove_card"; paymentId: string }
  | { type: "generate_link"; paymentId: string };

function formatIls(agorot: number) {
  const ils = agorot / 100;
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(ils);
}

function parseIlsToAgorot(value: string) {
  const normalized = value.replace(/,/g, ".").trim();
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

function statusLabel(status: SplitPaymentStatus) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "pending":
      return "Pending";
    case "authorized":
      return "Authorized";
    case "failed":
      return "Failed";
  }
}

export default function SplitPaymentPage() {
  const searchParams = useSearchParams();
  const { orderId } = useParams() as { orderId: string };

  const promoCode = searchParams.get("promoCode") || "dummy_code";
  const payerPaymentId = searchParams.get("pay");
  const payerToken = searchParams.get("token");

  const callbackTxId = searchParams.get("txId");
  const callbackPaymentId = searchParams.get("paymentId");
  const callbackResult = searchParams.get("result");

  const [loading, setLoading] = useState(true);
  const [split, setSplit] = useState<SplitPaymentStateV1 | null>(null);
  const [reservationStatus, setReservationStatus] = useState<string | null>(null);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isPayerView = Boolean(payerPaymentId && payerToken);

  const editingRef = useRef(false);

  const cards = useMemo(() => {
    if (!split) return [];
    if (!isPayerView) return split.cards;
    return split.cards.filter((c) => c.id === payerPaymentId);
  }, [split, isPayerView, payerPaymentId]);

  const sumAgorot = useMemo(() => {
    if (!split) return 0;
    return split.cards.reduce((s, c) => s + c.amount_agorot, 0);
  }, [split]);

  const authorizedAgorot = useMemo(() => {
    if (!split) return 0;
    return split.cards
      .filter((c) => c.status === "authorized")
      .reduce((s, c) => s + c.amount_agorot, 0);
  }, [split]);

  const isTotalValid = split ? sumAgorot === split.total_agorot : false;
  const anyPending = split ? split.cards.some((c) => c.status === "pending") : false;
  const progressPct = split
    ? Math.min(100, Math.round((authorizedAgorot / split.total_agorot) * 100))
    : 0;

  const maxCards = useMemo(() => {
    if (!split) return 0;
    const hasFailure = split.cards.some((c) => c.status === "failed");
    return hasFailure ? split.failure_max_cards : split.base_max_cards;
  }, [split]);

  const loadSession = async () => {
    try {
      setError(null);
      const res = await fetch(`/api/split-payment/session/${orderId}`);
      if (res.status === 404) {
        // init
        const initRes = await fetch(`/api/split-payment/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, promoCode }),
        });
        if (!initRes.ok) throw new Error("Failed to init split payment");
        const initData = await initRes.json();
        setSplit(initData.split);
        setReservationStatus("Pending");
        return;
      }
      if (!res.ok) throw new Error("Failed to load split payment");
      const data = await res.json();
      setSplit(data.split);
      setReservationStatus(data.reservationStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadSession();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (!split) return;
    const interval = setInterval(() => {
      if (editingRef.current) return;
      loadSession();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split?.promo_code]);

  useEffect(() => {
    if (!callbackTxId || !callbackPaymentId || !callbackResult) return;
    if (callbackResult !== "success") {
      // best-effort refresh to reflect failure
      loadSession();
      return;
    }

    (async () => {
      try {
        setBusyCardId(callbackPaymentId);
        const res = await fetch(
          `/api/split-payment/validate/${orderId}/${callbackPaymentId}/${callbackTxId}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Validation failed");
        setSplit(data.split);
        await loadSession();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Validation failed");
      } finally {
        setBusyCardId(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackTxId, callbackPaymentId, callbackResult]);

  const update = async (action: UpdateAction) => {
    const res = await fetch(`/api/split-payment/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Update failed");
    setSplit(data.split);
  };

  const handlePay = async (card: SplitPaymentCard) => {
    try {
      setError(null);
      setBusyCardId(card.id);
      const res = await fetch(`/api/split-payment/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentId: card.id,
          token: isPayerView ? payerToken : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to start payment");
      window.location.replace(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment");
      setBusyCardId(null);
    }
  };

  const handleGenerateLink = async (card: SplitPaymentCard) => {
    try {
      setError(null);
      await update({ type: "generate_link", paymentId: card.id });
      const fresh = await fetch(`/api/split-payment/session/${orderId}`);
      const session = await fresh.json();
      setSplit(session.split);

      const updatedCard = session.split.cards.find((c: SplitPaymentCard) => c.id === card.id);
      if (!updatedCard?.link_token) throw new Error("Missing link token");

      const base = window.location.origin;
      const url = `${base}/split-payment/${orderId}?pay=${card.id}&token=${updatedCard.link_token}`;
      await navigator.clipboard.writeText(url);
      setCopied(card.id);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate link");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!split) {
    return (
      <div className="max-w-3xl mx-auto p-6" dir="rtl">
        <h1 className="text-2xl font-bold mb-2">פיצול תשלום</h1>
        <p className="text-red-600">{error || "Failed to load"}</p>
      </div>
    );
  }

  const canPay = isTotalValid && !anyPending && reservationStatus !== "Paid";

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8" dir="rtl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">פיצול תשלום</h1>
          <div className="text-sm text-muted-foreground">
            סטטוס הזמנה: {reservationStatus || "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">סה״כ לתשלום</div>
          <div className="text-2xl font-bold">{formatIls(split.total_agorot)}</div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span>התקדמות</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded">
          <div
            className="h-2 bg-main rounded"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-sm text-muted-foreground mt-2">
          שולם/אושר: {formatIls(authorizedAgorot)} מתוך {formatIls(split.total_agorot)}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!isPayerView && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            onClick={() => update({ type: "split_even" })}
            disabled={anyPending || reservationStatus === "Paid"}
          >
            Split Even
          </Button>
          <Button
            variant="outline"
            onClick={() => update({ type: "add_card" })}
            disabled={anyPending || reservationStatus === "Paid" || split.cards.length >= maxCards}
          >
            <Plus className="h-4 w-4 ml-2" />
            Add card
          </Button>
          <div className="text-sm text-muted-foreground flex items-center">
            {split.cards.length}/{maxCards} cards
          </div>
        </div>
      )}

      <div className="space-y-3">
        {cards.map((card, idx) => {
          const locked = card.status === "authorized";
          const pending = card.status === "pending";
          const failed = card.status === "failed";

          return (
            <Card key={card.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground">תשלום {idx + 1}</div>
                  <div className="mt-2">
                    <label className="text-sm">סכום</label>
                    <Input
                      value={(card.amount_agorot / 100).toFixed(2)}
                      disabled={locked || pending || isPayerView || reservationStatus === "Paid"}
                      onFocus={() => {
                        editingRef.current = true;
                      }}
                      onBlur={() => {
                        editingRef.current = false;
                      }}
                      onChange={(e) => {
                        const ag = parseIlsToAgorot(e.target.value);
                        if (ag === null) return;
                        update({ type: "set_amount", paymentId: card.id, amount_agorot: ag }).catch((err) =>
                          setError(err instanceof Error ? err.message : "Update failed")
                        );
                      }}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      מינימום: {formatIls(split.min_amount_agorot)}
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <div className="text-sm font-medium">{statusLabel(card.status)}</div>
                  {failed && card.last_error && (
                    <div className="text-xs text-red-600 mt-1">{card.last_error}</div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  onClick={() => handlePay(card)}
                  disabled={!canPay || locked || pending || busyCardId === card.id}
                  className="bg-[#05203c] hover:bg-[#05203c]/90"
                >
                  <CreditCard className="h-4 w-4 ml-2" />
                  Pay Now
                  {busyCardId === card.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                </Button>

                {!isPayerView && (
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateLink(card)}
                    disabled={!isTotalValid || locked || pending || reservationStatus === "Paid"}
                  >
                    <Link2 className="h-4 w-4 ml-2" />
                    Send Payment Link
                    {copied === card.id ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                  </Button>
                )}

                {!isPayerView && (
                  <Button
                    variant="outline"
                    onClick={() => update({ type: "remove_card", paymentId: card.id })}
                    disabled={
                      split.cards.length <= split.min_cards ||
                      locked ||
                      pending ||
                      anyPending ||
                      reservationStatus === "Paid"
                    }
                  >
                    <Trash2 className="h-4 w-4 ml-2" />
                    Remove
                  </Button>
                )}

                {failed && !locked && !pending && (
                  <div className="text-xs text-muted-foreground flex items-center">
                    <XCircle className="h-4 w-4 ml-2 text-red-600" />
                    אפשר לנסות שוב או להוסיף כרטיס נוסף
                  </div>
                )}
              </div>

              {!isTotalValid && !isPayerView && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  פעולות תשלום זמינות רק כשהסכומים מסתכמים בדיוק לסכום ההזמנה.
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {!isPayerView && reservationStatus === "Paid" && (
        <div className="mt-6 p-4 rounded border border-green-200 bg-green-50 text-green-800 text-sm">
          התשלום הושלם. ההזמנה מסומנת כ״שולמה״.
        </div>
      )}
    </div>
  );
}
