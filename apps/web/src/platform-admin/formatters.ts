export function formatCurrency(
  value: string | number | null | undefined,
  currency = "INR",
): string {
  if (value === null || value === undefined || value === "") return "Price not set";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Price unavailable";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatBillingCycle(value: string | null | undefined): string {
  switch (value) {
    case "ANNUAL": return "Annual";
    case "MONTHLY": return "Monthly";
    default: return value ? value.toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "Billing cycle not set";
  }
}
