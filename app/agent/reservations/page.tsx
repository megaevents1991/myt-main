import { requirePartner } from "@/lib/partner-auth";
import { getPortalReservations, type PortalReservation } from "@/lib/agent-reservations-actions";
import { PAID_STATUS } from "@/lib/partner-commission";

export const dynamic = "force-dynamic";

// Raw `status` column values → what the partner sees. Anything unrecognised
// (a status this page doesn't know about yet) falls back to the raw value
// rather than hiding it.
function statusLabel(status: string): string {
  if (status === PAID_STATUS) return "שולם";
  if (status === "24Save") return "הזמנה פתוחה (טרם שולמה)";
  if (status === "Pending") return "ממתין לתשלום";
  return status;
}

function statusBadgeClass(status: string): string {
  if (status === PAID_STATUS) return "bg-green-100 text-green-700";
  if (status === "24Save") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("he-IL");
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Hebrew "time left" for a still-open hold, given its expiry instant. */
function timeRemainingLabel(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "פג תוקף";
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours <= 0) return `נותרו ${minutes} דקות`;
  return `נותרו כ-${hours} שעות`;
}

export default async function AgentReservationsPage() {
  // Shown to both agents and influencers — requirePartner() is the real
  // gate, no role check (getPortalReservations guards the same way).
  await requirePartner();
  const { rows, truncated } = await getPortalReservations();

  const paidRows = rows.filter((r) => r.status === PAID_STATUS);
  const paidCount = paidRows.length;
  const paidTickets = paidRows.reduce((sum, r) => sum + r.tickets, 0);
  const totalSales = paidRows.reduce((sum, r) => sum + r.user_shown_price, 0);
  // Non-paid rows already carry commission_usd === 0, so summing every row
  // and summing only paidRows give the same total — summing paidRows keeps
  // the intent explicit.
  const totalCommission = paidRows.reduce((sum, r) => sum + r.commission_usd, 0);

  const holds = rows.filter((r) => r.is_hold);

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">הזמנות</h1>
        <p className="text-sm text-gray-500">כל ההזמנות שנוצרו עם קוד השיוך שלכם.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border p-3">
          <p className="text-xs text-gray-500">הזמנות ששולמו</p>
          <p className="text-lg font-semibold">{paidCount.toLocaleString("he-IL")}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-gray-500">כרטיסים ששולמו</p>
          <p className="text-lg font-semibold">{paidTickets.toLocaleString("he-IL")}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-gray-500">סה&quot;כ מכירות</p>
          <p className="text-lg font-semibold">{formatUsd(totalSales)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-gray-500">סה&quot;כ עמלה</p>
          <p className="text-lg font-semibold">{formatUsd(totalCommission)}</p>
        </div>
      </div>

      {holds.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">הזמנות פתוחות</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-3 py-2 font-medium">לקוח</th>
                  <th className="px-3 py-2 font-medium">אירוע</th>
                  <th className="px-3 py-2 font-medium">נוצרה</th>
                  <th className="px-3 py-2 font-medium">זמן שנותר</th>
                </tr>
              </thead>
              <tbody>
                {holds.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.customer_name || "—"}</td>
                    <td className="px-3 py-2">{r.event_title || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-2 font-medium">
                      {timeRemainingLabel(r.hold_expires_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
          עדיין אין הזמנות עם קוד השיוך שלכם.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-3 py-2 font-medium">לקוח</th>
                  <th className="px-3 py-2 font-medium">אירוע</th>
                  <th className="px-3 py-2 font-medium">קטגוריה</th>
                  <th className="px-3 py-2 font-medium">כרטיסים</th>
                  <th className="px-3 py-2 font-medium">נוסעים</th>
                  <th className="px-3 py-2 font-medium">סטטוס</th>
                  <th className="px-3 py-2 font-medium">אישור נשלח</th>
                  <th className="px-3 py-2 font-medium">סכום מכירה</th>
                  <th className="px-3 py-2 font-medium">עמלה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: PortalReservation) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2">{r.customer_name || "—"}</td>
                    <td className="px-3 py-2">
                      <div>{r.event_title || "—"}</div>
                      <div className="text-xs text-gray-500">{formatDate(r.event_date)}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.ticket_category || "—"}</td>
                    <td className="px-3 py-2">{r.tickets}</td>
                    <td className="px-3 py-2">{r.pax}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.materials_sent ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          נשלח
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          טרם נשלח
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">{formatUsd(r.user_shown_price)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{formatUsd(r.commission_usd)}</div>
                      {r.status === PAID_STATUS && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.billed
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {r.billed ? "שולמה לכם" : "ממתינה לדיווח"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated && (
            <p className="text-xs text-gray-500">
              מוצגות ההזמנות האחרונות בלבד — קיימות הזמנות ישנות יותר שאינן מופיעות ברשימה זו.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
