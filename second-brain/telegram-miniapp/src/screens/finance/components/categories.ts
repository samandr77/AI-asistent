export const EXPENSE_CATEGORIES = [
  { value: "food", label: "Продукты" },
  { value: "cafe", label: "Кафе и рестораны" },
  { value: "transport", label: "Транспорт" },
  { value: "housing", label: "Жильё и ЖКХ" },
  { value: "shopping", label: "Шопинг" },
  { value: "entertainment", label: "Развлечения" },
  { value: "health", label: "Здоровье" },
  { value: "subscriptions", label: "Подписки" },
  { value: "other", label: "Другое" },
] as const;

export const INCOME_CATEGORIES = [
  { value: "salary", label: "Зарплата" },
  { value: "freelance", label: "Фриланс" },
  { value: "rent", label: "Аренда" },
  { value: "investment", label: "Инвестиции" },
  { value: "other", label: "Другое" },
] as const;

export const DEBT_TYPES = [
  { value: "credit_card", label: "Кредитка" },
  { value: "loan", label: "Кредит" },
  { value: "mortgage", label: "Ипотека" },
  { value: "installment", label: "Рассрочка" },
  { value: "personal", label: "Личный долг" },
  { value: "other", label: "Другое" },
] as const;

export const ASSET_TYPES = [
  { value: "cash", label: "Кэш и вклады" },
  { value: "brokerage", label: "Брокерский счёт" },
  { value: "retirement", label: "Пенсионный" },
  { value: "real_estate", label: "Недвижимость" },
  { value: "vehicle", label: "Транспорт" },
  { value: "other", label: "Другое" },
] as const;

export const DOC_KINDS = [
  { value: "receipt", label: "Чек" },
  { value: "invoice", label: "Счёт" },
  { value: "contract", label: "Договор" },
  { value: "tax", label: "Налоговый документ" },
  { value: "other", label: "Другое" },
] as const;

export function rubToCents(value: string): number | null {
  const normalised = value.replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
