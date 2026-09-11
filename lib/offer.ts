// Structured pricing + payment schedule for the Project / Financial Offer.
// Stored on the offer Document.content alongside the template text fields.

export type Currency = "EUR" | "USD" | "RSD";

export const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: "EUR", label: "EUR (€)", symbol: "€" },
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "RSD", label: "RSD (дин)", symbol: "дин" },
];

export const DEFAULT_CURRENCY: Currency = "EUR";

export type Milestone = {
  id: string;
  name: string;
  date?: string | null; // optional ISO date
  amount?: string | null; // kept as string to allow free-form entry
};

export type OfferPricing = {
  currency: Currency;
  oneTimePrice?: string | null;
  monthlyPrice?: string | null;
  paymentSchedule: Milestone[];
};

export function currencySymbol(c: Currency | string | undefined): string {
  return CURRENCIES.find((x) => x.value === c)?.symbol ?? "€";
}

// Format an amount with its currency symbol. Numbers get grouped; free text is
// returned as-is (prefixed with the symbol when it looks numeric).
export function formatMoney(amount: string | null | undefined, currency: Currency | string | undefined): string {
  if (amount == null || String(amount).trim() === "") return "—";
  const raw = String(amount).trim();
  const sym = currencySymbol(currency);
  const num = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isNaN(num) && /^[0-9.,\s]+$/.test(raw)) {
    return `${sym}${num.toLocaleString()}`;
  }
  return raw;
}

// Read the structured pricing off a document's content, with safe defaults.
export function readPricing(content: Record<string, unknown> | null | undefined): OfferPricing {
  const c = (content ?? {}) as Record<string, unknown>;
  const currency = (CURRENCIES.some((x) => x.value === c.currency) ? c.currency : DEFAULT_CURRENCY) as Currency;
  const schedule = Array.isArray(c.paymentSchedule) ? (c.paymentSchedule as Milestone[]) : [];
  return {
    currency,
    oneTimePrice: (c.oneTimePrice as string) ?? null,
    monthlyPrice: (c.monthlyPrice as string) ?? null,
    paymentSchedule: schedule,
  };
}

export function newMilestoneId(): string {
  return `ms_${Math.random().toString(36).slice(2, 9)}`;
}
