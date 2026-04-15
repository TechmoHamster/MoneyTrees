import type {
  Bill,
  BillCategory,
  BillStatus,
  CategoryBreakdownItem,
  DashboardSummary,
  DebtReportingSnapshot,
  ReportingDelta,
  ReportingRange,
  ReportingSnapshot,
  ReportingTrendPoint,
  RunningBalanceRow,
  SortBy,
  SortDirection,
} from "@/lib/types";

const CENTS_IN_DOLLAR = 100;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const statusPriority: Record<BillStatus, number> = {
  "Past Due": 0,
  Upcoming: 1,
  Paid: 2,
};
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DateOnlyParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateOnly(dateString: string): DateOnlyParts | null {
  if (!DATE_ONLY_REGEX.test(dateString)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = dateString.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const asLocalDate = new Date(year, month - 1, day);
  if (
    asLocalDate.getFullYear() !== year ||
    asLocalDate.getMonth() !== month - 1 ||
    asLocalDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getDateSortKey(dateString: string): number | null {
  const parsed = parseDateOnly(dateString);
  if (!parsed) {
    return null;
  }

  return parsed.year * 10_000 + parsed.month * 100 + parsed.day;
}

function getDateOnly(dateString: string): Date | null {
  const parsed = parseDateOnly(dateString);
  if (!parsed) {
    return null;
  }

  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

function isCountedBill(bill: Bill, includePaidInTotals: boolean): boolean {
  return includePaidInTotals || bill.status !== "Paid";
}

function compareDateOnly(aDateString: string, bDateString: string): number {
  const aDate = getDateSortKey(aDateString);
  const bDate = getDateSortKey(bDateString);

  if (aDate === null && bDate === null) {
    return 0;
  }

  if (aDate === null) {
    return 1;
  }

  if (bDate === null) {
    return -1;
  }

  return aDate - bDate;
}

function compareName(a: Bill, b: Bill): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function sumToCents(values: number[]): number {
  return values.reduce((sum, value) => sum + toCents(value), 0);
}

function getTodayDateOnly(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getBillLateFeeAmount(bill: Bill): number {
  if (typeof bill.lateFeeAmount !== "number" || !Number.isFinite(bill.lateFeeAmount)) {
    return 0;
  }

  if (bill.lateFeeAmount <= 0) {
    return 0;
  }

  return normalizeAmount(bill.lateFeeAmount);
}

export function getBillTotalAmount(bill: Bill): number {
  return normalizeAmount(bill.amount + getBillLateFeeAmount(bill));
}

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * CENTS_IN_DOLLAR);
}

export function fromCents(cents: number): number {
  return cents / CENTS_IN_DOLLAR;
}

export function normalizeAmount(amount: number): number {
  return fromCents(toCents(amount));
}

export function isValidDateOnly(dateString: string): boolean {
  return parseDateOnly(dateString) !== null;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(normalizeAmount(value));
}

export function formatDate(dateString: string): string {
  const parsed = parseDateOnly(dateString);
  if (!parsed) {
    return "-";
  }

  const asLocalDate = new Date(parsed.year, parsed.month - 1, parsed.day);
  return asLocalDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function sortBills(
  bills: Bill[],
  sortBy: SortBy,
  direction: SortDirection,
): Bill[] {
  const sorted = [...bills].sort((a, b) => {
    if (sortBy === "dueDate") {
      const dateCompare = compareDateOnly(a.dueDate, b.dueDate);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return compareName(a, b);
    }

    if (sortBy === "status") {
      const statusCompare = statusPriority[a.status] - statusPriority[b.status];
      if (statusCompare !== 0) {
        return statusCompare;
      }

      const dateCompare = compareDateOnly(a.dueDate, b.dueDate);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return compareName(a, b);
    }

    const categoryCompare = a.category.localeCompare(b.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    const dateCompare = compareDateOnly(a.dueDate, b.dueDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return compareName(a, b);
  });

  return direction === "asc" ? sorted : sorted.reverse();
}

export function calculateSummary(
  bills: Bill[],
  startingBalance: number,
  includePaidInTotals: boolean,
): DashboardSummary {
  const startingBalanceCents = toCents(startingBalance);
  const allBillsCents = sumToCents(bills.map((bill) => getBillTotalAmount(bill)));
  const paidTotalCents = sumToCents(
    bills.filter((bill) => bill.status === "Paid").map((bill) => getBillTotalAmount(bill)),
  );
  const unpaidTotalCents = allBillsCents - paidTotalCents;
  const totalBillsCents = includePaidInTotals ? allBillsCents : unpaidTotalCents;
  const balanceLeftCents = startingBalanceCents - totalBillsCents;

  const categoryTotals = bills.reduce<
    Map<BillCategory, { count: number; pastDueCount: number; totalCents: number }>
  >((accumulator, bill) => {
    if (!isCountedBill(bill, includePaidInTotals)) {
      return accumulator;
    }

    const existing = accumulator.get(bill.category) ?? {
      count: 0,
      pastDueCount: 0,
      totalCents: 0,
    };

    accumulator.set(bill.category, {
      count: existing.count + 1,
      pastDueCount:
        bill.status === "Past Due" ? existing.pastDueCount + 1 : existing.pastDueCount,
      totalCents: existing.totalCents + toCents(getBillTotalAmount(bill)),
    });

    return accumulator;
  }, new Map());

  const categoryBreakdown: CategoryBreakdownItem[] = [...categoryTotals.entries()]
    .map(([category, data]) => ({
      category,
      count: data.count,
      pastDueCount: data.pastDueCount,
      total: fromCents(data.totalCents),
    }))
    .sort((a, b) => b.total - a.total);

  const activeDatedBills = bills
    .filter((bill) => bill.status !== "Paid")
    .map((bill) => ({ bill, dueDate: getDateOnly(bill.dueDate) }))
    .filter((value): value is { bill: Bill; dueDate: Date } => value.dueDate !== null);

  const today = getTodayDateOnly();
  const dueIn7DaysBoundary = new Date(today);
  dueIn7DaysBoundary.setDate(dueIn7DaysBoundary.getDate() + 7);

  const dueIn7DaysBills = activeDatedBills.filter(
    ({ dueDate }) => dueDate >= today && dueDate <= dueIn7DaysBoundary,
  );
  const dueIn7DaysTotalCents = sumToCents(
    dueIn7DaysBills.map(({ bill }) => getBillTotalAmount(bill)),
  );

  const dueThisMonthBills = activeDatedBills.filter(({ dueDate }) => {
    return (
      dueDate.getFullYear() === today.getFullYear() &&
      dueDate.getMonth() === today.getMonth()
    );
  });
  const dueThisMonthTotalCents = sumToCents(
    dueThisMonthBills.map(({ bill }) => getBillTotalAmount(bill)),
  );

  const nextBillDue = activeDatedBills
    .filter(({ dueDate }) => dueDate >= today)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  const consideredLateFeeBills = bills.filter((bill) => isCountedBill(bill, includePaidInTotals));
  const lateFeeAmounts = consideredLateFeeBills.map((bill) => getBillLateFeeAmount(bill));
  const totalLateFeesCents = sumToCents(lateFeeAmounts);
  const billsWithLateFees = lateFeeAmounts.filter((amount) => amount > 0).length;
  const highestLateFee = Math.max(0, ...lateFeeAmounts);

  return {
    totalBills: fromCents(totalBillsCents),
    numberOfBills: bills.length,
    balanceLeft: fromCents(balanceLeftCents),
    negativeAmount: balanceLeftCents < 0 ? fromCents(Math.abs(balanceLeftCents)) : 0,
    activeBillCount: bills.filter((bill) => bill.status !== "Paid").length,
    allBillsTotal: fromCents(allBillsCents),
    pastDueCount: bills.filter((bill) => bill.status === "Past Due").length,
    paidTotal: fromCents(paidTotalCents),
    unpaidTotal: fromCents(unpaidTotalCents),
    categoryBreakdown,
    dueIn7DaysCount: dueIn7DaysBills.length,
    dueIn7DaysTotal: fromCents(dueIn7DaysTotalCents),
    dueThisMonthTotal: fromCents(dueThisMonthTotalCents),
    nextBillDueDate: nextBillDue?.bill.dueDate,
    nextBillDueAmount: nextBillDue ? getBillTotalAmount(nextBillDue.bill) : 0,
    totalLateFees: fromCents(totalLateFeesCents),
    billsWithLateFees,
    lateFeePercentOfTotal:
      totalBillsCents > 0
        ? normalizeAmount((fromCents(totalLateFeesCents) / fromCents(totalBillsCents)) * 100)
        : 0,
    highestLateFee: normalizeAmount(highestLateFee),
  };
}

export function calculateRunningBalances(
  bills: Bill[],
  startingBalance: number,
  includePaidInTotals: boolean,
): RunningBalanceRow[] {
  let runningTotalCents = 0;
  const startingBalanceCents = toCents(startingBalance);

  // Running totals should follow the canonical sorted sequence so filtering only hides rows.
  return bills.map((bill) => {
    const countedCents = isCountedBill(bill, includePaidInTotals)
      ? toCents(getBillTotalAmount(bill))
      : 0;

    runningTotalCents += countedCents;

    return {
      billId: bill.id,
      countedAmount: fromCents(countedCents),
      runningTotal: fromCents(runningTotalCents),
      remainingBalance: fromCents(startingBalanceCents - runningTotalCents),
    };
  });
}

export function getUpcomingBills(bills: Bill[], limit = 5): Bill[] {
  const today = getTodayDateOnly();
  const upcomingBills = bills
    .filter((bill) => bill.status === "Upcoming")
    .map((bill) => ({ bill, dueDate: getDateOnly(bill.dueDate) }))
    .filter((value): value is { bill: Bill; dueDate: Date } => value.dueDate !== null)
    .sort((a, b) => {
      const dateCompare = a.dueDate.getTime() - b.dueDate.getTime();
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return a.bill.name.localeCompare(b.bill.name, undefined, { sensitivity: "base" });
    });

  const futureUpcoming = upcomingBills.filter((entry) => entry.dueDate >= today);
  const source = futureUpcoming.length > 0 ? futureUpcoming : upcomingBills;
  return source.slice(0, limit).map((entry) => entry.bill);
}

export function buildSmartInsights(
  bills: Bill[],
  summary: DashboardSummary,
  includePaidInTotals: boolean,
): string[] {
  const insightCandidates: Array<{ text: string; score: number }> = [];

  if (summary.pastDueCount > 0) {
    insightCandidates.push({
      text: `${summary.pastDueCount} bill${summary.pastDueCount === 1 ? "" : "s"} need immediate attention.`,
      score: 120 + summary.pastDueCount * 8,
    });
  }

  if (summary.dueIn7DaysCount > 0) {
    insightCandidates.push({
      text: `Near-term pressure is building: ${summary.dueIn7DaysCount} bill${summary.dueIn7DaysCount === 1 ? "" : "s"} are due within 7 days (${formatCurrency(summary.dueIn7DaysTotal)}).`,
      score: 96 + summary.dueIn7DaysCount * 4,
    });
  }

  if (summary.balanceLeft < 0) {
    insightCandidates.push({
      text: `Current obligations push the balance ${formatCurrency(summary.negativeAmount)} below zero.`,
      score: 118 + Math.min(24, summary.negativeAmount * 0.05),
    });
  }

  const activeOrIncludedBills = bills.filter((bill) => isCountedBill(bill, includePaidInTotals));
  const lateFeeByCategory = activeOrIncludedBills.reduce<Map<BillCategory, number>>((map, bill) => {
    const lateFeeAmount = getBillLateFeeAmount(bill);
    if (lateFeeAmount <= 0) {
      return map;
    }

    map.set(bill.category, (map.get(bill.category) ?? 0) + lateFeeAmount);
    return map;
  }, new Map());

  const topLateFeeCategory = [...lateFeeByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topLateFeeCategory && summary.totalLateFees > 0) {
    const share = normalizeAmount((topLateFeeCategory[1] / summary.totalLateFees) * 100);
    insightCandidates.push({
      text:
        share >= 99
          ? `All current late-fee exposure is concentrated in ${topLateFeeCategory[0]}.`
          : `${topLateFeeCategory[0]} is driving most current late-fee pressure (${share}%).`,
      score: 88 + share * 0.22,
    });
  }

  const unpaidByCategory = bills
    .filter((bill) => bill.status !== "Paid")
    .reduce<Map<BillCategory, number>>((map, bill) => {
      map.set(bill.category, (map.get(bill.category) ?? 0) + getBillTotalAmount(bill));
      return map;
    }, new Map());

  const topUnpaidCategory = [...unpaidByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topUnpaidCategory && summary.unpaidTotal > 0) {
    const share = normalizeAmount((topUnpaidCategory[1] / summary.unpaidTotal) * 100);
    insightCandidates.push({
      text:
        share >= 99
          ? `All current pressure is concentrated in ${topUnpaidCategory[0]}.`
          : `${topUnpaidCategory[0]} carries the largest share of unpaid pressure (${share}%).`,
      score: 80 + share * 0.25,
    });
  }

  if (summary.billsWithLateFees > 0) {
    insightCandidates.push({
      text:
        summary.billsWithLateFees === 1
          ? "Late-fee exposure is isolated, which makes payoff prioritization clearer."
          : `${summary.billsWithLateFees} bills already include late fees, so cleanup order matters more than usual.`,
      score: 78 + summary.billsWithLateFees * 4,
    });
  }

  if (insightCandidates.length === 0) {
    return ["No urgent shifts are showing in the current bill mix."];
  }

  return insightCandidates
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.text)
    .slice(0, 4);
}

export function billMatchesSearchQuery(bill: Bill, searchQuery: string): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }

  const searchableParts = [
    bill.name,
    bill.category,
    bill.notes,
    bill.paymentMethod,
    bill.paymentNote,
  ]
    .map((value) => normalizeOptionalString(value))
    .filter((value): value is string => Boolean(value));

  return searchableParts.some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function buildCsv(bills: Bill[]): string {
  const header = [
    "Bill Name",
    "Category",
    "Status",
    "Due Date",
    "Base Amount",
    "Applied Late Fee",
    "Total Amount",
    "Date Paid",
    "Amount Paid",
    "Payment Method",
    "Payment Note",
    "Notes",
  ];

  const rows = bills.map((bill) => [
    bill.name,
    bill.category,
    bill.status,
    bill.dueDate,
    normalizeAmount(bill.amount).toFixed(2),
    normalizeAmount(getBillLateFeeAmount(bill)).toFixed(2),
    normalizeAmount(getBillTotalAmount(bill)).toFixed(2),
    bill.paidDate ?? "",
    typeof bill.paidAmount === "number" && Number.isFinite(bill.paidAmount)
      ? normalizeAmount(bill.paidAmount).toFixed(2)
      : "",
    bill.paymentMethod ?? "",
    bill.paymentNote ?? "",
    bill.notes ?? "",
  ]);

  const csvLines = [header, ...rows].map((row) =>
    row
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );

  return csvLines.join("\n");
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - next.getDay());
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function createRangeWindow(range: ReportingRange): {
  range: ReportingRange;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
} {
  const today = getTodayDateOnly();
  const end = today;
  let start = today;
  let label = "This Month";

  if (range === "day") {
    start = today;
    label = "Today";
  } else if (range === "week") {
    start = startOfWeek(today);
    label = "This Week";
  } else if (range === "month") {
    start = startOfMonth(today);
    label = "This Month";
  } else {
    start = startOfYear(today);
    label = "This Year";
  }

  const lengthDays = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS) + 1,
  );
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(lengthDays - 1));

  return {
    range,
    start,
    end,
    previousStart,
    previousEnd,
    label,
  };
}

type ReportingBillPoint = {
  bill: Bill;
  eventDate: Date;
  eventDateString: string;
  totalAmount: number;
  lateFeeAmount: number;
};

function toReportingBillPoint(bill: Bill): ReportingBillPoint | null {
  const preferredDate =
    bill.status === "Paid" && bill.paidDate && isValidDateOnly(bill.paidDate)
      ? bill.paidDate
      : bill.dueDate;
  const date = getDateOnly(preferredDate);
  if (!date) {
    return null;
  }

  return {
    bill,
    eventDate: date,
    eventDateString: toDateOnlyString(date),
    totalAmount: getBillTotalAmount(bill),
    lateFeeAmount: getBillLateFeeAmount(bill),
  };
}

function filterPointsByRange(
  points: ReportingBillPoint[],
  start: Date,
  end: Date,
): ReportingBillPoint[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return points.filter((point) => {
    const eventMs = point.eventDate.getTime();
    return eventMs >= startMs && eventMs <= endMs;
  });
}

function toDelta(current: number, previous: number): ReportingDelta {
  const delta = normalizeAmount(current - previous);
  const deltaPercent =
    previous > 0 ? normalizeAmount((delta / previous) * 100) : current > 0 ? 100 : 0;

  return {
    current: normalizeAmount(current),
    previous: normalizeAmount(previous),
    delta,
    deltaPercent,
  };
}

function buildTrendBuckets(
  range: ReportingRange,
  start: Date,
  end: Date,
): Array<{ key: string; label: string; start: Date; end: Date }> {
  if (range === "day") {
    const key = toDateOnlyString(start);
    return [{ key, label: formatDate(key), start, end }];
  }

  if (range === "week") {
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];
    let cursor = new Date(start);
    while (cursor <= end) {
      const key = toDateOnlyString(cursor);
      buckets.push({
        key,
        label: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        start: cursor,
        end: cursor,
      });
      cursor = addDays(cursor, 1);
    }
    return buckets;
  }

  if (range === "month") {
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];
    let cursor = new Date(start);
    let index = 1;
    while (cursor <= end) {
      const bucketEnd = addDays(cursor, 6);
      const safeEnd = bucketEnd <= end ? bucketEnd : end;
      buckets.push({
        key: `${toDateOnlyString(cursor)}:${toDateOnlyString(safeEnd)}`,
        label: `W${index}`,
        start: cursor,
        end: safeEnd,
      });
      cursor = addDays(safeEnd, 1);
      index += 1;
    }
    return buckets;
  }

  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  let monthCursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (monthCursor <= end) {
    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const safeStart = monthStart < start ? start : monthStart;
    const safeEnd = monthEnd > end ? end : monthEnd;
    const key = `${safeStart.getFullYear()}-${String(safeStart.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: safeStart.toLocaleDateString("en-US", { month: "short" }),
      start: safeStart,
      end: safeEnd,
    });
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
  }
  return buckets;
}

function sumPointAmounts(points: ReportingBillPoint[]): {
  totalBills: number;
  totalPaid: number;
  totalUnpaid: number;
  totalLateFees: number;
} {
  const totalBills = normalizeAmount(
    points.reduce((sum, point) => sum + point.totalAmount, 0),
  );
  const totalPaid = normalizeAmount(
    points
      .filter((point) => point.bill.status === "Paid")
      .reduce((sum, point) => sum + point.totalAmount, 0),
  );
  const totalUnpaid = normalizeAmount(totalBills - totalPaid);
  const totalLateFees = normalizeAmount(
    points.reduce((sum, point) => sum + point.lateFeeAmount, 0),
  );

  return { totalBills, totalPaid, totalUnpaid, totalLateFees };
}

function toReportingTrend(
  points: ReportingBillPoint[],
  buckets: Array<{ key: string; label: string; start: Date; end: Date }>,
): ReportingTrendPoint[] {
  return buckets.map((bucket) => {
    const bucketPoints = filterPointsByRange(points, bucket.start, bucket.end);
    return {
      key: bucket.key,
      label: bucket.label,
      total: normalizeAmount(
        bucketPoints.reduce((sum, point) => sum + point.totalAmount, 0),
      ),
      lateFees: normalizeAmount(
        bucketPoints.reduce((sum, point) => sum + point.lateFeeAmount, 0),
      ),
      billCount: bucketPoints.length,
      paidCount: bucketPoints.filter((point) => point.bill.status === "Paid").length,
      pastDueCount: bucketPoints.filter((point) => point.bill.status === "Past Due").length,
    };
  });
}

export function calculateReportingSnapshot(
  bills: Bill[],
  range: ReportingRange,
): ReportingSnapshot {
  const window = createRangeWindow(range);
  const points = bills
    .map((bill) => toReportingBillPoint(bill))
    .filter((point): point is ReportingBillPoint => point !== null);

  const currentRangePoints = filterPointsByRange(points, window.start, window.end);
  const previousRangePoints = filterPointsByRange(
    points,
    window.previousStart,
    window.previousEnd,
  );

  const currentTotals = sumPointAmounts(currentRangePoints);
  const previousTotals = sumPointAmounts(previousRangePoints);

  const numberOfBills = currentRangePoints.length;
  const numberOfPaidBills = currentRangePoints.filter(
    (point) => point.bill.status === "Paid",
  ).length;
  const numberOfUpcomingBills = currentRangePoints.filter(
    (point) => point.bill.status === "Upcoming",
  ).length;
  const numberOfPastDueBills = currentRangePoints.filter(
    (point) => point.bill.status === "Past Due",
  ).length;
  const numberOfBillsWithLateFees = currentRangePoints.filter(
    (point) => point.lateFeeAmount > 0,
  ).length;

  const averageBillAmount =
    numberOfBills > 0 ? normalizeAmount(currentTotals.totalBills / numberOfBills) : 0;
  const highestBillAmount = normalizeAmount(
    Math.max(0, ...currentRangePoints.map((point) => point.totalAmount)),
  );
  const highestLateFee = normalizeAmount(
    Math.max(0, ...currentRangePoints.map((point) => point.lateFeeAmount)),
  );

  const lateFeesPercentOfTotal =
    currentTotals.totalBills > 0
      ? normalizeAmount((currentTotals.totalLateFees / currentTotals.totalBills) * 100)
      : 0;
  const paidPercent =
    currentTotals.totalBills > 0
      ? normalizeAmount((currentTotals.totalPaid / currentTotals.totalBills) * 100)
      : 0;
  const unpaidPercent = normalizeAmount(100 - paidPercent);

  const categoryMap = currentRangePoints.reduce<
    Map<BillCategory, { total: number; billCount: number; lateFees: number }>
  >((map, point) => {
    const existing = map.get(point.bill.category) ?? {
      total: 0,
      billCount: 0,
      lateFees: 0,
    };
    map.set(point.bill.category, {
      total: normalizeAmount(existing.total + point.totalAmount),
      billCount: existing.billCount + 1,
      lateFees: normalizeAmount(existing.lateFees + point.lateFeeAmount),
    });
    return map;
  }, new Map());

  const categoryBreakdown = [...categoryMap.entries()]
    .map(([category, value]) => ({
      category,
      total: value.total,
      percentOfTotal:
        currentTotals.totalBills > 0
          ? normalizeAmount((value.total / currentTotals.totalBills) * 100)
          : 0,
      billCount: value.billCount,
      lateFees: value.lateFees,
    }))
    .sort((a, b) => b.total - a.total);

  const statusMap = currentRangePoints.reduce<
    Map<BillStatus, { count: number; total: number }>
  >((map, point) => {
    const existing = map.get(point.bill.status) ?? { count: 0, total: 0 };
    map.set(point.bill.status, {
      count: existing.count + 1,
      total: normalizeAmount(existing.total + point.totalAmount),
    });
    return map;
  }, new Map());

  const orderedStatuses: BillStatus[] = ["Paid", "Upcoming", "Past Due"];
  const statusBreakdown = orderedStatuses.map((status) => {
    const value = statusMap.get(status) ?? { count: 0, total: 0 };
    return {
      status,
      count: value.count,
      total: value.total,
      percentOfTotal:
        currentTotals.totalBills > 0
          ? normalizeAmount((value.total / currentTotals.totalBills) * 100)
          : 0,
    };
  });

  const trendBuckets = buildTrendBuckets(range, window.start, window.end);
  const trend = toReportingTrend(currentRangePoints, trendBuckets);

  const topCategory = categoryBreakdown[0];
  const lateFeeCategoryMap = categoryBreakdown
    .filter((item) => item.lateFees > 0)
    .sort((a, b) => b.lateFees - a.lateFees)[0];

  const mostExpensivePoint = [...currentRangePoints].sort(
    (a, b) => b.totalAmount - a.totalAmount,
  )[0];
  const largestLateFeePoint = [...currentRangePoints].sort(
    (a, b) => b.lateFeeAmount - a.lateFeeAmount,
  )[0];

  return {
    range,
    periodStart: toDateOnlyString(window.start),
    periodEnd: toDateOnlyString(window.end),
    previousPeriodStart: toDateOnlyString(window.previousStart),
    previousPeriodEnd: toDateOnlyString(window.previousEnd),
    periodLabel: window.label,
    totalBills: currentTotals.totalBills,
    totalPaid: currentTotals.totalPaid,
    totalUnpaid: currentTotals.totalUnpaid,
    totalLateFees: currentTotals.totalLateFees,
    averageBillAmount,
    highestBillAmount,
    highestLateFee,
    numberOfBills,
    numberOfPaidBills,
    numberOfUpcomingBills,
    numberOfPastDueBills,
    numberOfBillsWithLateFees,
    lateFeesPercentOfTotal,
    paidPercent,
    unpaidPercent,
    categoryBreakdown,
    statusBreakdown,
    trend,
    topCategory: topCategory?.category,
    topCategoryPercent: topCategory?.percentOfTotal ?? 0,
    biggestLateFeeCategory: lateFeeCategoryMap?.category,
    mostExpensiveBill: mostExpensivePoint
      ? {
          id: mostExpensivePoint.bill.id,
          name: mostExpensivePoint.bill.name,
          category: mostExpensivePoint.bill.category,
          amount: mostExpensivePoint.totalAmount,
          dueDate: mostExpensivePoint.bill.dueDate,
        }
      : undefined,
    largestLateFeeBill:
      largestLateFeePoint && largestLateFeePoint.lateFeeAmount > 0
        ? {
            id: largestLateFeePoint.bill.id,
            name: largestLateFeePoint.bill.name,
            category: largestLateFeePoint.bill.category,
            lateFeeAmount: largestLateFeePoint.lateFeeAmount,
            dueDate: largestLateFeePoint.bill.dueDate,
          }
        : undefined,
    totalBillsDelta: toDelta(currentTotals.totalBills, previousTotals.totalBills),
    totalLateFeesDelta: toDelta(
      currentTotals.totalLateFees,
      previousTotals.totalLateFees,
    ),
    pastDueCountDelta: toDelta(
      numberOfPastDueBills,
      previousRangePoints.filter((point) => point.bill.status === "Past Due").length,
    ),
    billCountDelta: toDelta(numberOfBills, previousRangePoints.length),
  };
}

function toCsvValue(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function buildReportingCsv(
  snapshot: ReportingSnapshot,
  debtSnapshot?: DebtReportingSnapshot | null,
): string {
  const lines: string[] = [];

  lines.push(
    ["Metric", "Value"].map((value) => toCsvValue(value)).join(","),
    ["Range", snapshot.periodLabel].map((value) => toCsvValue(value)).join(","),
    ["Period Start", snapshot.periodStart].map((value) => toCsvValue(value)).join(","),
    ["Period End", snapshot.periodEnd].map((value) => toCsvValue(value)).join(","),
    ["Previous Period Start", snapshot.previousPeriodStart]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Previous Period End", snapshot.previousPeriodEnd]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Total Bills", snapshot.totalBills.toFixed(2)].map((value) => toCsvValue(value)).join(","),
    ["Total Paid", snapshot.totalPaid.toFixed(2)].map((value) => toCsvValue(value)).join(","),
    ["Total Unpaid", snapshot.totalUnpaid.toFixed(2)].map((value) => toCsvValue(value)).join(","),
    ["Total Late Fees", snapshot.totalLateFees.toFixed(2)]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Average Bill Amount", snapshot.averageBillAmount.toFixed(2)]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Highest Bill Amount", snapshot.highestBillAmount.toFixed(2)]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Highest Late Fee", snapshot.highestLateFee.toFixed(2)]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Number Of Bills", snapshot.numberOfBills].map((value) => toCsvValue(value)).join(","),
    ["Number Of Paid Bills", snapshot.numberOfPaidBills]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Number Of Upcoming Bills", snapshot.numberOfUpcomingBills]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Number Of Past Due Bills", snapshot.numberOfPastDueBills]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Bills With Late Fees", snapshot.numberOfBillsWithLateFees]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Late Fees Percent", snapshot.lateFeesPercentOfTotal.toFixed(2)]
      .map((value) => toCsvValue(value))
      .join(","),
    ["Paid Percent", snapshot.paidPercent.toFixed(2)].map((value) => toCsvValue(value)).join(","),
    ["Unpaid Percent", snapshot.unpaidPercent.toFixed(2)]
      .map((value) => toCsvValue(value))
      .join(","),
    "",
    ["Category", "Total", "Percent", "Bill Count", "Late Fees"]
      .map((value) => toCsvValue(value))
      .join(","),
  );

  snapshot.categoryBreakdown.forEach((item) => {
    lines.push(
      [
        item.category,
        item.total.toFixed(2),
        item.percentOfTotal.toFixed(2),
        item.billCount,
        item.lateFees.toFixed(2),
      ]
        .map((value) => toCsvValue(value))
        .join(","),
    );
  });

  lines.push(
    "",
    ["Status", "Count", "Total", "Percent"].map((value) => toCsvValue(value)).join(","),
  );

  snapshot.statusBreakdown.forEach((item) => {
    lines.push(
      [item.status, item.count, item.total.toFixed(2), item.percentOfTotal.toFixed(2)]
        .map((value) => toCsvValue(value))
        .join(","),
    );
  });

  lines.push(
    "",
    ["Trend Label", "Total", "Late Fees", "Bill Count", "Paid Count", "Past Due Count"]
      .map((value) => toCsvValue(value))
      .join(","),
  );

  snapshot.trend.forEach((point) => {
    lines.push(
      [
        point.label,
        point.total.toFixed(2),
        point.lateFees.toFixed(2),
        point.billCount,
        point.paidCount,
        point.pastDueCount,
      ]
        .map((value) => toCsvValue(value))
        .join(","),
    );
  });

  if (debtSnapshot) {
    lines.push(
      "",
      ["Debt Metric", "Value"].map((value) => toCsvValue(value)).join(","),
      ["Debt Total Balance", debtSnapshot.totalDebtBalance.toFixed(2)]
        .map((value) => toCsvValue(value))
        .join(","),
      ["Debt Accounts Behind", debtSnapshot.accountsBehindCount]
        .map((value) => toCsvValue(value))
        .join(","),
      ["Debt Delinquent Accounts", debtSnapshot.delinquentAccountCount]
        .map((value) => toCsvValue(value))
        .join(","),
      ["Debt Cash Needed 30d", debtSnapshot.debtCashNeeded30d.toFixed(2)]
        .map((value) => toCsvValue(value))
        .join(","),
      ["Debt Amount Needed To Cure", debtSnapshot.amountNeededToCure.toFixed(2)]
        .map((value) => toCsvValue(value))
        .join(","),
      ["Debt Limited Confidence Count", debtSnapshot.limitedConfidenceCount]
        .map((value) => toCsvValue(value))
        .join(","),
      ["Debt Source Conflict Count", debtSnapshot.sourceConflictCount]
        .map((value) => toCsvValue(value))
        .join(","),
      ["Debt Event Context", debtSnapshot.eventContextNote]
        .map((value) => toCsvValue(value))
        .join(","),
    );
  }

  return lines.join("\n");
}

export function buildReportingJson(
  snapshot: ReportingSnapshot,
  debtSnapshot?: DebtReportingSnapshot | null,
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      report: snapshot,
      debtReport: debtSnapshot ?? undefined,
    },
    null,
    2,
  );
}
