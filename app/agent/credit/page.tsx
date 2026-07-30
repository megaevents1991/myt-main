import { getMyCredit } from "@/lib/agent-credit-actions";
import { ConvertCredit } from "./convert-credit";

export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default async function AgentCreditPage() {
  const credit = await getMyCredit();

  return (
    <main className="max-w-3xl space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold">הצבירה שלי</h1>
        <p className="text-sm text-gray-500">
          {credit.creditPerTicket > 0
            ? `צוברים ${usd.format(credit.creditPerTicket)} על כל כרטיס בהזמנה ששולמה.`
            : "אין הסכם צבירה פעיל בחשבון הזה."}
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">יתרה להמרה</p>
            <p className="text-4xl font-bold">{usd.format(credit.balanceUsd)}</p>
            <p className="mt-1 text-sm text-gray-500">
              נצבר {usd.format(credit.accruedUsd)} על {credit.paidTickets} כרטיסים · מומש{" "}
              {usd.format(credit.redeemedUsd)}
              {credit.returnedUsd > 0 && <> · חזר לצבירה {usd.format(credit.returnedUsd)}</>}
            </p>
          </div>
          <ConvertCredit balanceUsd={credit.balanceUsd} />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="font-bold">הקופונים שיצרתם מהצבירה</h2>
        <p className="mb-3 text-sm text-gray-500">
          אם קופון נוצל רק בחלקו, ההפרש חוזר אוטומטית ליתרה שלכם.
        </p>
        {credit.history.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">עדיין לא המרתם צבירה לקופון.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-3 py-2 font-medium">תאריך</th>
                  <th className="px-3 py-2 font-medium">קוד קופון</th>
                  <th className="px-3 py-2 font-medium">שווי</th>
                  <th className="px-3 py-2 font-medium">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {credit.history.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(row.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-3 py-2 font-mono">{row.coupon_code}</td>
                    <td className="px-3 py-2">{usd.format(Number(row.amount_usd))}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {row.outstanding
                        ? "זמין לשימוש"
                        : row.returned_usd > 0
                          ? `נוצל ${usd.format(row.used_usd)} · ${usd.format(row.returned_usd)} חזרו לצבירה`
                          : "נוצל במלואו"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
