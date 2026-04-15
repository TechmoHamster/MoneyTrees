"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileJson2,
  FileSpreadsheet,
  FolderKanban,
  Info,
  Landmark,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  BillCategory,
  DebtReportingSnapshot,
  ReportingCategoryBreakdownItem,
  ReportingRange,
  ReportingSnapshot,
} from "@/lib/types";
import {
  buildReportingCsv,
  buildReportingJson,
  formatCurrency,
  formatDate,
} from "@/lib/utils";

type ReportingSectionProps = {
  snapshot: ReportingSnapshot;
  debtSnapshot?: DebtReportingSnapshot | null;
  selectedRange: ReportingRange;
  activeCategoryFilter: BillCategory | "All";
  onRangeChange: (next: ReportingRange) => void;
  onCategoryDrillDown: (category: BillCategory, sourceSectionId: string) => void;
  onClearCategoryFilter: () => void;
  onBackToCategoryBreakdown: () => void;
  onOpenDebt?: () => void;
};

type CategorySlice = {
  category: BillCategory;
  total: number;
  percent: number;
  displayLength: number;
  offset: number;
  color: string;
};

const RANGE_OPTIONS: Array<{ id: ReportingRange; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

const CATEGORY_COLORS = [
  "#2563eb",
  "#0d9488",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0284c7",
  "#a16207",
];

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.0%";
  }

  return `${value.toFixed(1)}%`;
}

function formatSignedPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatSignedCurrency(value: number): string {
  if (value === 0) {
    return "$0.00";
  }

  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function buildReportFileStem(snapshot: ReportingSnapshot, range: ReportingRange): string {
  return `report-${range}-${snapshot.periodStart}_to_${snapshot.periodEnd}`;
}

function toPercent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (value / total) * 100));
}

function buildSparklinePath(values: number[], width = 112, height = 30): string {
  if (values.length === 0) {
    return `M 0 ${height / 2} L ${width} ${height / 2}`;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = index * step;
      const normalized = (value - min) / range;
      const y = height - normalized * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildCategorySlices(items: ReportingCategoryBreakdownItem[]): CategorySlice[] {
  let offset = 0;
  return items.map((item, index) => {
    const slice = {
      category: item.category,
      total: item.total,
      percent: item.percentOfTotal,
      displayLength: Math.max(item.percentOfTotal - 1.2, item.percentOfTotal * 0.62),
      offset,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    };
    offset += item.percentOfTotal;
    return slice;
  });
}

function getDeltaClass(delta: number, positiveIsGood = true): string {
  if (delta === 0) {
    return "text-slate-700";
  }

  const positiveClass = positiveIsGood ? "text-emerald-700" : "text-rose-700";
  const negativeClass = positiveIsGood ? "text-rose-700" : "text-emerald-700";
  return delta > 0 ? positiveClass : negativeClass;
}

function getTrendChipClass(delta: number, positiveIsGood: boolean): string {
  if (delta === 0) {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  const positiveClass = positiveIsGood
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : "border-rose-300 bg-rose-50 text-rose-700";
  const negativeClass = positiveIsGood
    ? "border-rose-300 bg-rose-50 text-rose-700"
    : "border-emerald-300 bg-emerald-50 text-emerald-700";

  return delta > 0 ? positiveClass : negativeClass;
}

function buildPriorityAction(snapshot: ReportingSnapshot): string {
  if (snapshot.numberOfPastDueBills > 0) {
    return `${snapshot.numberOfPastDueBills} past-due bill${snapshot.numberOfPastDueBills === 1 ? "" : "s"} should be cleared before anything else in this window.`;
  }

  if (snapshot.totalLateFees > 0 && snapshot.biggestLateFeeCategory) {
    return `Late-fee pressure is already active in ${snapshot.biggestLateFeeCategory}, so that category is the cleanest place to reduce avoidable loss first.`;
  }

  if (snapshot.topCategory) {
    return `${snapshot.topCategory} is carrying most of the current period pressure, so it is the first category worth reviewing for concentration risk.`;
  }

  return "The current reporting window does not show a single dominant pressure source yet.";
}

function buildPriorityLabel(snapshot: ReportingSnapshot): string {
  if (snapshot.numberOfPastDueBills > 0) {
    return "Immediate priority: reduce past-due pressure";
  }

  if (snapshot.totalLateFees > 0) {
    return "Priority: reduce fee leakage";
  }

  if (snapshot.topCategory) {
    return `Priority: review ${snapshot.topCategory} concentration`;
  }

  return "Priority: monitor this period";
}

export function ReportingSection({
  snapshot,
  debtSnapshot,
  selectedRange,
  activeCategoryFilter,
  onRangeChange,
  onCategoryDrillDown,
  onClearCategoryFilter,
  onBackToCategoryBreakdown,
  onOpenDebt,
}: ReportingSectionProps) {
  const [showAttributionInfo, setShowAttributionInfo] = useState(false);
  const [chartPopover, setChartPopover] = useState<{
    category: BillCategory;
    x: number;
    y: number;
  } | null>(null);
  const chartPanelRef = useRef<HTMLDivElement | null>(null);

  const categorySlices = useMemo(
    () => buildCategorySlices(snapshot.categoryBreakdown),
    [snapshot.categoryBreakdown],
  );
  const fileStem = buildReportFileStem(snapshot, selectedRange);
  const trendPointsWithActivity = snapshot.trend.filter(
    (point) => point.total > 0 || point.lateFees > 0,
  ).length;
  const isSparseTrend =
    snapshot.trend.length > 0 &&
    (snapshot.trend.length < 3 || trendPointsWithActivity < 2);
  const obligationSparkline = buildSparklinePath(
    snapshot.trend.map((point) => point.total),
  );
  const lateFeeSparkline = buildSparklinePath(
    snapshot.trend.map((point) => point.lateFees),
  );
  const paidAmountWidth = toPercent(snapshot.totalPaid, snapshot.totalBills || 1);
  const unpaidAmountWidth = toPercent(snapshot.totalUnpaid, snapshot.totalBills || 1);
  const lateFeeAmountWidth = toPercent(snapshot.totalLateFees, snapshot.totalBills || 1);
  const statusTotal = Math.max(
    1,
    snapshot.statusBreakdown.reduce((sum, item) => sum + item.count, 0),
  );
  const lateFeeCountWidth = toPercent(
    snapshot.numberOfBillsWithLateFees,
    snapshot.numberOfBills || 1,
  );
  const priorityLabel = buildPriorityLabel(snapshot);
  const priorityAction = buildPriorityAction(snapshot);
  const activePopoverSlice = chartPopover
    ? categorySlices.find((slice) => slice.category === chartPopover.category)
    : null;
  const isActivePopoverCategory = Boolean(
    activePopoverSlice && activeCategoryFilter === activePopoverSlice.category,
  );
  const debtTypeLeader = debtSnapshot?.typeDistribution[0];
  const debtEventRows = debtSnapshot
    ? [
        { label: "Payment failures", value: debtSnapshot.eventSummary.paymentFailures },
        { label: "Payment reversals", value: debtSnapshot.eventSummary.paymentReversals },
        { label: "Standing transitions", value: debtSnapshot.eventSummary.standingTransitions },
        { label: "Arrangement changes", value: debtSnapshot.eventSummary.arrangementChanges },
        { label: "Promo expirations", value: debtSnapshot.eventSummary.promoExpirations },
        { label: "Capitalization events", value: debtSnapshot.eventSummary.capitalizationEvents },
        { label: "Continuity events", value: debtSnapshot.eventSummary.continuityEvents },
        { label: "Collections events", value: debtSnapshot.eventSummary.collectionsEvents },
      ]
    : [];
  const maxDebtEventCount = debtEventRows.reduce(
    (max, item) => Math.max(max, item.value),
    1,
  );

  function openChartPopover(
    category: BillCategory,
    event: ReactMouseEvent<SVGCircleElement, MouseEvent>,
  ) {
    const containerRect = chartPanelRef.current?.getBoundingClientRect();
    if (!containerRect) {
      setChartPopover({ category, x: 16, y: 16 });
      return;
    }

    setChartPopover({
      category,
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
    });
  }

  useEffect(() => {
    if (!chartPopover) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!chartPanelRef.current?.contains(event.target as Node)) {
        setChartPopover(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setChartPopover(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [chartPopover]);

  return (
    <section className="dashboard-shell dashboard-shell-strip dashboard-animate-in rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BarChart3 className="h-4 w-4 text-blue-700" />
            Reporting
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Decision-oriented read on obligations, trend movement, and pressure inside the current {snapshot.periodLabel.toLowerCase()} window.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadTextFile(`${fileStem}.csv`, buildReportingCsv(snapshot), "text/csv")
            }
            className="dashboard-control dashboard-hover-lift inline-flex items-center gap-1 rounded-lg border border-blue-600 bg-gradient-to-r from-blue-600 to-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:from-blue-500 hover:to-indigo-500"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Report CSV
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(`${fileStem}.json`, buildReportingJson(snapshot), "application/json")
            }
            className="dashboard-control inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FileJson2 className="h-3.5 w-3.5" />
            Export Report JSON
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => {
          const active = selectedRange === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onRangeChange(option.id)}
              className={`dashboard-control dashboard-hover-lift rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                active
                  ? "border-blue-700 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_20px_-14px_rgba(37,99,235,0.75)]"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="dashboard-shell-inner mt-4 rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <CalendarDays className="h-3.5 w-3.5 text-blue-700" />
              Active Reporting Window
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {snapshot.periodLabel}: {formatDate(snapshot.periodStart)} to {formatDate(snapshot.periodEnd)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTrendChipClass(
                snapshot.pastDueCountDelta.delta,
                false,
              )}`}
            >
              Past Due {snapshot.pastDueCountDelta.delta > 0 ? "Worsening" : snapshot.pastDueCountDelta.delta < 0 ? "Improving" : "Flat"}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTrendChipClass(
                snapshot.totalLateFeesDelta.delta,
                false,
              )}`}
            >
              Late Fees {snapshot.totalLateFeesDelta.delta > 0 ? "Worsening" : snapshot.totalLateFeesDelta.delta < 0 ? "Improving" : "Flat"}
            </span>
          </div>
        </div>

        <div className="dashboard-empty-state mt-3 rounded-2xl px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{priorityLabel}</p>
          <p className="mt-1 text-slate-600">{priorityAction}</p>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAttributionInfo((previous) => !previous)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-expanded={showAttributionInfo}
            aria-controls="reporting-attribution-info"
          >
            <Info className="h-3.5 w-3.5 text-blue-700" />
            {showAttributionInfo ? "Hide Info" : "Show Info"}
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-500 transition ${
                showAttributionInfo ? "rotate-180" : ""
              }`}
            />
          </button>
          {showAttributionInfo ? (
            <p id="reporting-attribution-info" className="mt-2 text-sm leading-relaxed text-slate-700">
              Attribution uses <span className="font-semibold text-slate-900">Date Paid</span> for paid bills when valid; otherwise it falls back to the bill <span className="font-semibold text-slate-900">Due Date</span>.
            </p>
          ) : null}
        </div>
      </div>

      {activeCategoryFilter !== "All" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">
            Active Audit Filter:
          </p>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            Category {activeCategoryFilter}
          </span>
          <button
            type="button"
            onClick={onClearCategoryFilter}
            className="dashboard-control rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Clear Category Filter
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="dashboard-shell-inner rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Total Obligation
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(snapshot.totalBills)}
          </p>
          <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${getDeltaClass(snapshot.totalBillsDelta.delta, true)}`}>
            {snapshot.totalBillsDelta.delta >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatSignedCurrency(snapshot.totalBillsDelta.delta)} ({formatSignedPercent(snapshot.totalBillsDelta.deltaPercent)})
          </p>
          <svg viewBox="0 0 112 30" className="mt-2 h-7 w-full" role="img" aria-label="Total obligation trend sparkline">
            <path d={obligationSparkline} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </article>

        <article className="dashboard-shell-inner rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Past Due Bills
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {snapshot.numberOfPastDueBills}
          </p>
          <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${getDeltaClass(snapshot.pastDueCountDelta.delta, false)}`}>
            {snapshot.pastDueCountDelta.delta >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {snapshot.pastDueCountDelta.delta >= 0 ? "+" : ""}{snapshot.pastDueCountDelta.delta.toFixed(0)} vs previous period
          </p>
        </article>

        <article className="dashboard-shell-inner rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Late Fees
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {formatCurrency(snapshot.totalLateFees)}
          </p>
          <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${getDeltaClass(snapshot.totalLateFeesDelta.delta, false)}`}>
            {snapshot.totalLateFeesDelta.delta >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {formatSignedCurrency(snapshot.totalLateFeesDelta.delta)} ({formatSignedPercent(snapshot.totalLateFeesDelta.deltaPercent)})
          </p>
          <svg viewBox="0 0 112 30" className="mt-2 h-7 w-full" role="img" aria-label="Late fee trend sparkline">
            <path d={lateFeeSparkline} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </article>

        <article className="dashboard-shell-inner rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Top Pressure Source
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {snapshot.topCategory ?? snapshot.biggestLateFeeCategory ?? "No data"}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {snapshot.topCategory
              ? `${formatPercent(snapshot.topCategoryPercent)} of this period sits in ${snapshot.topCategory}.`
              : "Add activity in this range to identify the dominant source."}
          </p>
        </article>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <article className="dashboard-shell-inner rounded-2xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Financial Summary
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Total Paid</dt>
              <dd className="font-semibold text-emerald-700">{formatCurrency(snapshot.totalPaid)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Total Unpaid</dt>
              <dd className="font-semibold text-slate-900">{formatCurrency(snapshot.totalUnpaid)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Average Bill Amount</dt>
              <dd className="font-semibold text-slate-900">{formatCurrency(snapshot.averageBillAmount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600">Highest Bill Amount</dt>
              <dd className="font-semibold text-slate-900">{formatCurrency(snapshot.highestBillAmount)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white/86 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Amount Composition
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className="flex h-full w-full">
                <span className="h-full bg-emerald-500" style={{ width: `${paidAmountWidth}%` }} />
                <span className="h-full bg-blue-500" style={{ width: `${unpaidAmountWidth}%` }} />
                <span className="h-full bg-amber-500" style={{ width: `${lateFeeAmountWidth}%` }} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Paid {formatPercent(snapshot.paidPercent)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Unpaid {formatPercent(snapshot.unpaidPercent)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Late fee share {formatPercent(snapshot.lateFeesPercentOfTotal)}
              </span>
            </div>
          </div>
        </article>

        <article className="dashboard-shell-inner rounded-2xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Status & Pressure
          </h3>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-slate-200 bg-white/86 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Bills With Late Fees
              </p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-600">
                <span>{snapshot.numberOfBillsWithLateFees} of {snapshot.numberOfBills} bills</span>
                <span className="font-semibold text-amber-700">{formatPercent(lateFeeCountWidth)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${lateFeeCountWidth}%` }} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/86 p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Combined Status Distribution
              </p>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                {snapshot.statusBreakdown.map((statusItem) => (
                  <span
                    key={statusItem.status}
                    className={`h-full ${
                      statusItem.status === "Paid"
                        ? "bg-emerald-500"
                        : statusItem.status === "Past Due"
                          ? "bg-rose-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${toPercent(statusItem.count, statusTotal)}%` }}
                    title={`${statusItem.status}: ${statusItem.count}`}
                  />
                ))}
              </div>
            </div>

            {snapshot.statusBreakdown.map((statusItem) => (
              <div key={statusItem.status}>
                <p className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    {statusItem.status === "Paid" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : statusItem.status === "Past Due" ? (
                      <Clock3 className="h-3.5 w-3.5 text-rose-600" />
                    ) : (
                      <FolderKanban className="h-3.5 w-3.5 text-blue-600" />
                    )}
                    {statusItem.status}
                  </span>
                  <span>{formatPercent(statusItem.percentOfTotal)}</span>
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      statusItem.status === "Paid"
                        ? "bg-emerald-500"
                        : statusItem.status === "Past Due"
                          ? "bg-rose-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, statusItem.percentOfTotal))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-shell-inner rounded-2xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Key Insights
          </h3>
          <div className="dashboard-empty-state mt-3 rounded-2xl px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Priority action</p>
            <p className="mt-1 text-slate-600">{priorityAction}</p>
          </div>

          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {snapshot.topCategory ? (
              <div className="rounded-xl border border-slate-200 bg-white/86 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Largest category share
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{snapshot.topCategory}</span> carries {formatPercent(snapshot.topCategoryPercent)} of this period.
                </p>
              </div>
            ) : null}

            {snapshot.mostExpensiveBill ? (
              <div className="rounded-xl border border-slate-200 bg-white/86 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Most expensive bill
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{snapshot.mostExpensiveBill.name}</span> at {formatCurrency(snapshot.mostExpensiveBill.amount)} due {formatDate(snapshot.mostExpensiveBill.dueDate)}.
                </p>
              </div>
            ) : null}

            {snapshot.biggestLateFeeCategory ? (
              <div className="rounded-xl border border-slate-200 bg-white/86 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fee concentration
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{snapshot.biggestLateFeeCategory}</span> is producing the strongest late-fee pressure in this window.
                </p>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      {debtSnapshot ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          <article className="dashboard-shell-inner rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                  <Landmark className="h-3.5 w-3.5 text-blue-700" />
                  Debt Analytics
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Current-state debt facts from Debt only.
                </p>
              </div>
              {onOpenDebt ? (
                <button
                  type="button"
                  onClick={onOpenDebt}
                  className="dashboard-control rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Open Debt
                </button>
              ) : null}
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">Total Debt</dt>
                <dd className="font-semibold text-slate-900">
                  {formatCurrency(debtSnapshot.totalDebtBalance)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">Debt Cash Needed - 30 Days</dt>
                <dd className="font-semibold text-slate-900">
                  {formatCurrency(debtSnapshot.debtCashNeeded30d)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">Accounts Behind</dt>
                <dd className="font-semibold text-rose-700">{debtSnapshot.accountsBehindCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">Amount Needed To Cure</dt>
                <dd className="font-semibold text-slate-900">
                  {formatCurrency(debtSnapshot.amountNeededToCure)}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {debtSnapshot.limitedConfidenceCount > 0 ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  Limited {debtSnapshot.limitedConfidenceCount}
                </span>
              ) : null}
              {debtSnapshot.sourceConflictCount > 0 ? (
                <span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                  Source conflict {debtSnapshot.sourceConflictCount}
                </span>
              ) : null}
            </div>
          </article>

          <article className="dashboard-shell-inner rounded-2xl p-4">
            <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <ShieldAlert className="h-3.5 w-3.5 text-blue-700" />
              Debt Event Activity
            </h3>
            <div className="mt-3 space-y-2">
              {debtEventRows.map((row) => (
                <div key={row.label}>
                  <p className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{row.label}</span>
                    <span className="font-semibold text-slate-900">{row.value}</span>
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            row.value > 0 ? 10 : 0,
                            maxDebtEventCount > 0 ? (row.value / maxDebtEventCount) * 100 : 0,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {debtSnapshot.eventContextNote}
            </p>
          </article>

          <article className="dashboard-shell-inner rounded-2xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              Debt Type Mix
            </h3>
            <div className="mt-3 space-y-2">
              {debtSnapshot.typeDistribution.map((item) => (
                <div key={item.debtType}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">{item.debtType}</span>
                    <span>
                      {formatCurrency(item.totalBalance)} • {formatPercent(item.percentOfTotal)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, Math.max(0, item.percentOfTotal))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {debtTypeLeader
                ? `${debtTypeLeader.debtType} currently carries the largest share of tracked debt balance.`
                : debtSnapshot.snapshotContextNote}
            </p>
          </article>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="dashboard-shell-inner rounded-2xl p-4">
          <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            <TrendingUp className="h-3.5 w-3.5 text-blue-700" />
            Bills Over Time
          </h3>
          {snapshot.trend.length === 0 ? (
            <div className="dashboard-empty-state mt-3 rounded-xl px-4 py-4 text-sm text-slate-600">
              No dated bill activity in this period.
            </div>
          ) : isSparseTrend ? (
            <div className="dashboard-empty-state mt-3 rounded-xl px-4 py-4 text-sm text-slate-600">
              The selected period is too sparse for a reliable time-series read. Try Week, Month, or Year for stronger trend visibility.
            </div>
          ) : (
            <div className="dashboard-animate-in mt-3">
              <div className="flex h-48 items-end gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
                {snapshot.trend.map((point) => {
                  const maxTrendTotal = Math.max(1, ...snapshot.trend.map((entry) => entry.total));
                  const maxTrendLateFees = Math.max(1, ...snapshot.trend.map((entry) => entry.lateFees));
                  const billHeight = (point.total / maxTrendTotal) * 100;
                  const feeHeight = (point.lateFees / maxTrendLateFees) * 100;
                  return (
                    <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <div className="flex h-32 w-full items-end justify-center gap-1">
                        <div
                          className="w-3 rounded-t-md bg-blue-500/85"
                          style={{ height: `${Math.max(4, billHeight)}%` }}
                          title={`${point.label} total ${formatCurrency(point.total)}`}
                        />
                        <div
                          className="w-2 rounded-t-md bg-amber-500/85"
                          style={{ height: `${Math.max(point.lateFees > 0 ? 4 : 0, feeHeight)}%` }}
                          title={`${point.label} late fees ${formatCurrency(point.lateFees)}`}
                        />
                      </div>
                      <p className="truncate text-[10px] font-medium text-slate-600">{point.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 inline-flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                  Total bills
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  Late fees
                </span>
              </div>
            </div>
          )}
        </article>

        <article
          id="reporting-category-share-section"
          className="dashboard-shell-inner rounded-2xl p-4"
        >
          <h3 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            <TrendingDown className="h-3.5 w-3.5 text-blue-700" />
            Category Share
          </h3>
          {snapshot.categoryBreakdown.length === 0 ? (
            <div className="dashboard-empty-state mt-3 rounded-xl px-4 py-4 text-sm text-slate-600">
              No category data in this period.
            </div>
          ) : (
            <div
              ref={chartPanelRef}
              className="dashboard-animate-in relative mt-3 flex flex-col gap-3 sm:flex-row sm:items-start"
            >
              <svg
                width="210"
                height="210"
                viewBox="0 0 200 200"
                role="img"
                aria-label="Reporting category share chart"
                className="mx-auto shrink-0"
              >
                <circle cx="100" cy="100" r="70" fill="none" stroke="#dbe5f5" strokeWidth="24" />
                {categorySlices.map((slice) => (
                  <circle
                    key={slice.category}
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="24"
                    strokeDasharray={`${slice.displayLength} ${100 - slice.displayLength}`}
                    strokeDashoffset={-slice.offset}
                    strokeLinecap="round"
                    pathLength={100}
                    transform="rotate(-90 100 100)"
                    className="dashboard-chart-segment cursor-pointer transition-[opacity,filter] hover:opacity-90 hover:drop-shadow-[0_0_6px_rgba(59,130,246,0.35)]"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${slice.category} details`}
                    onClick={(event) => openChartPopover(slice.category, event)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setChartPopover({ category: slice.category, x: 92, y: 92 });
                      }
                    }}
                  />
                ))}
                <circle cx="100" cy="100" r="48" fill="#f8fbff" stroke="#dbe7fb" strokeWidth="1.5" />
                <text x="100" y="91" textAnchor="middle" className="fill-slate-500 text-[8px] font-semibold uppercase tracking-[0.2em]">
                  Total
                </text>
                <text x="100" y="112" textAnchor="middle" className="fill-slate-900 text-[14px] font-semibold">
                  {formatCurrency(snapshot.totalBills)}
                </text>
              </svg>

              <div className="grid w-full auto-rows-min content-start gap-2 self-start">
                {categorySlices.map((slice) => (
                  <button
                    key={slice.category}
                    type="button"
                    onClick={() => onCategoryDrillDown(slice.category, "reporting-category-share-section")}
                    className="dashboard-control dashboard-hover-lift flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-700">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                      {slice.category}
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold text-slate-900">
                        {formatPercent(slice.percent)}
                      </span>
                      <span className="block text-xs text-slate-600">
                        {formatCurrency(slice.total)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {activePopoverSlice && chartPopover ? (
                <div
                  className="dashboard-animate-in absolute z-10 w-52 rounded-xl border border-slate-300 bg-white p-3 shadow-[0_20px_30px_-24px_rgba(15,23,42,0.7)]"
                  style={{
                    left: `clamp(0.5rem, ${chartPopover.x}px, calc(100% - 13.5rem))`,
                    top: `clamp(0.5rem, ${chartPopover.y}px, calc(100% - 9rem))`,
                  }}
                  role="dialog"
                  aria-label={`${activePopoverSlice.category} category options`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {activePopoverSlice.category}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatPercent(activePopoverSlice.percent)} • {formatCurrency(activePopoverSlice.total)}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (isActivePopoverCategory) {
                          onBackToCategoryBreakdown();
                        } else {
                          onCategoryDrillDown(activePopoverSlice.category, "reporting-category-share-section");
                        }
                        setChartPopover(null);
                      }}
                      className="dashboard-control inline-flex flex-1 items-center justify-center rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      {isActivePopoverCategory ? "Back to All" : "Filter Table"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartPopover(null)}
                      className="dashboard-control inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
