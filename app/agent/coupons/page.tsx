import { requirePartner } from "@/lib/partner-auth";
import { getPortalCoupons } from "@/lib/agent-coupons-actions";

export const dynamic = "force-dynamic";

export default async function AgentCouponsPage() {
  // Shown to both agents and influencers — requirePartner() is the real
  // gate, no role check (getPortalCoupons guards the same way).
  await requirePartner();
  const coupons = await getPortalCoupons();

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">קופונים</h1>
        <p className="text-sm text-gray-500">קופוני ההנחה המשויכים לקוד שלכם.</p>
      </div>

      {coupons.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-gray-500">
          עדיין אין קופונים משויכים אליכם.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-right">
              <tr>
                <th className="px-3 py-2 font-medium">קוד</th>
                <th className="px-3 py-2 font-medium">הנחה</th>
                <th className="px-3 py-2 font-medium">שימושים</th>
                <th className="px-3 py-2 font-medium">שולמו</th>
                <th className="px-3 py-2 font-medium">בתוקף עד</th>
                <th className="px-3 py-2 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-t">
                  <td className="px-3 py-2 font-mono font-medium">{coupon.code}</td>
                  <td className="px-3 py-2">
                    {coupon.discount_type === "percent"
                      ? `${coupon.discount_value}%`
                      : `$${coupon.discount_value}`}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {coupon.max_uses != null
                      ? `${coupon.times_used ?? 0}/${coupon.max_uses}`
                      : coupon.times_used ?? 0}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{coupon.times_paid ?? 0}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {coupon.valid_until
                      ? new Date(coupon.valid_until).toLocaleDateString("he-IL")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (coupon.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500")
                      }
                    >
                      {coupon.is_active ? "פעיל" : "לא פעיל"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
