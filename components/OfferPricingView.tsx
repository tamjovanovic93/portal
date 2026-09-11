import { readPricing, formatMoney } from "@/lib/offer";

// Read-only render of an offer's structured pricing + payment schedule. Used on
// both the admin document view and the client portal offer view.
export default function OfferPricingView({ content }: { content: Record<string, unknown> }) {
  const pricing = readPricing(content);
  const hasOneTime = pricing.oneTimePrice && String(pricing.oneTimePrice).trim() !== "";
  const hasMonthly = pricing.monthlyPrice && String(pricing.monthlyPrice).trim() !== "";
  const hasSchedule = pricing.paymentSchedule.length > 0;

  if (!hasOneTime && !hasMonthly && !hasSchedule) return null;

  return (
    <div className="space-y-4">
      {(hasOneTime || hasMonthly) && (
        <div className="flex flex-wrap gap-6">
          {hasOneTime && (
            <div>
              <p className="text-xs text-neutral-500">Price — one time</p>
              <p className="text-lg font-semibold text-neutral-900">
                {formatMoney(pricing.oneTimePrice, pricing.currency)}
              </p>
            </div>
          )}
          {hasMonthly && (
            <div>
              <p className="text-xs text-neutral-500">Price — monthly</p>
              <p className="text-lg font-semibold text-neutral-900">
                {formatMoney(pricing.monthlyPrice, pricing.currency)}
                <span className="text-sm font-normal text-neutral-500"> / mo</span>
              </p>
            </div>
          )}
        </div>
      )}

      {hasSchedule && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">Payment schedule</p>
          <div className="border border-neutral-200 rounded-md overflow-hidden">
            {pricing.paymentSchedule.map((m, i) => (
              <div
                key={m.id ?? i}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
                style={{ borderTop: i ? "1px solid var(--border, #e5e5e5)" : "none" }}
              >
                <div className="min-w-0">
                  <span className="text-neutral-800">{m.name || `Milestone ${i + 1}`}</span>
                  {m.date && (
                    <span className="text-xs text-neutral-500 ml-2">
                      {new Date(m.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <span className="text-neutral-900 font-medium shrink-0 ml-3">
                  {formatMoney(m.amount, pricing.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
