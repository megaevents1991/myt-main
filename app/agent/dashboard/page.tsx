import { getAgentDashboard } from "@/lib/agent-dashboard-actions";

export const dynamic = "force-dynamic";

function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

export default async function AgentDashboardPage() {
  // Nav has no dedicated tab yet; this is the real gate regardless — same
  // requirePartner() every other /agent page relies on, so a demoted or
  // deactivated partner never sees stale numbers.
  const dashboard = await getAgentDashboard();
  const maxVisitors = Math.max(1, ...dashboard.traffic.byStage.map((s) => s.visitors));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">לוח בקרה</h1>
        <p className="text-sm text-gray-500">העמלה שלכם: {dashboard.commission.label}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">עמלה</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="ממתין לתשלום" value={usd(dashboard.commission.pendingUsd)} />
          <StatTile label="שולם (בדוח החודשי)" value={usd(dashboard.commission.billedUsd)} />
          <StatTile label="השנה, סה&quot;כ" value={usd(dashboard.commission.yearToDateUsd)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">פעילות</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="הזמנות ששולמו" value={String(dashboard.paidReservations)} />
          <StatTile label="סה&quot;כ הזמנות" value={String(dashboard.totalReservations)} />
          <StatTile label="כרטיסים ששולמו" value={String(dashboard.paidTickets)} />
          <StatTile label="סה&quot;כ מכירות" value={usd(dashboard.totalSalesUsd)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">קופונים</h2>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <StatTile label="קופונים פעילים" value={String(dashboard.activeCoupons)} />
          <StatTile label="שימושים בקופונים" value={String(dashboard.couponUses)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">משפך המרה</h2>
        {!dashboard.traffic.hasData ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
            עדיין אין נתוני תנועה עבור קוד המעקב שלכם.
          </p>
        ) : (
          <div className="space-y-2 rounded-md border p-4">
            {dashboard.traffic.byStage.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-gray-600">{stage.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                  <div
                    className="h-full rounded bg-main"
                    style={{ width: `${(stage.visitors / maxVisitors) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-left font-medium">{stage.visitors}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">מה הקהל שלכם מסתכל עליו</h2>
        {dashboard.clickedEvents.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
            עדיין אין קליקים על אירועים דרך קוד המעקב שלכם.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-3 py-2 font-medium">אירוע</th>
                  <th className="px-3 py-2 font-medium">תאריך</th>
                  <th className="px-3 py-2 font-medium">מיקום</th>
                  <th className="px-3 py-2 font-medium">מבקרים</th>
                  <th className="px-3 py-2 font-medium">קליקים</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {dashboard.clickedEvents.map((event, i) => (
                  <tr key={`${event.name}-${i}`} className="border-t">
                    <td className="px-3 py-2 font-medium">{event.name}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {event.date ? new Date(event.date).toLocaleDateString("he-IL") : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{event.location || "—"}</td>
                    <td className="px-3 py-2">{event.visitors}</td>
                    <td className="px-3 py-2">{event.clicks}</td>
                    <td className="px-3 py-2 text-left">
                      {event.booked && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          הוזמן
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
