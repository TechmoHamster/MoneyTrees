"use client";

import {
  Landmark,
  ShieldAlert,
} from "lucide-react";
import type { DebtOverviewSnapshot } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type DebtOverviewSnapshotSectionProps = {
  snapshot: DebtOverviewSnapshot;
  onOpenDebt: () => void;
  onOpenAccountsBehind: () => void;
  onOpenNextDebtPayment: (accountId?: string) => void;
  onOpenDebtCash: () => void;
  onOpenNeedsReview: () => void;
};

export function DebtOverviewSnapshotSection({
  snapshot,
  onOpenDebt,
  onOpenAccountsBehind,
  onOpenNextDebtPayment,
  onOpenDebtCash,
  onOpenNeedsReview,
}: DebtOverviewSnapshotSectionProps) {
  const hasTrustSignals =
    snapshot.limitedConfidenceCount > 0 || snapshot.sourceConflictCount > 0;

  return (
    <section className="dashboard-shell dashboard-shell-strip dashboard-animate-in rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Landmark className="h-4 w-4 text-blue-700" />
            Debt Snapshot
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Compact debt visibility only. Open Debt for lifecycle detail, schedules, and account-level edits.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenDebt}
          className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Open Debt
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={onOpenDebt}
          className="dashboard-shell-inner rounded-2xl p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Total Debt
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(snapshot.totalDebtBalance)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {snapshot.activeAccountCount} active account{snapshot.activeAccountCount === 1 ? "" : "s"}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenAccountsBehind}
          className="dashboard-shell-inner rounded-2xl p-4 text-left transition hover:border-rose-200 hover:bg-rose-50/30"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Accounts Behind
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {snapshot.accountsBehindCount}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Debt-defined late or delinquent accounts.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onOpenNextDebtPayment(snapshot.nextDebtPayment?.accountId)}
          className="dashboard-shell-inner rounded-2xl p-4 text-left transition hover:border-amber-200 hover:bg-amber-50/30"
          disabled={!snapshot.nextDebtPayment}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Next Debt Payment
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {snapshot.nextDebtPayment
              ? formatCurrency(snapshot.nextDebtPayment.dueAmount)
              : "No upcoming row"}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {snapshot.nextDebtPayment
              ? `${snapshot.nextDebtPayment.accountName} due ${formatDate(snapshot.nextDebtPayment.dueDate)}`
              : "Debt has not emitted a near-term payment row."}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenDebtCash}
          className="dashboard-shell-inner rounded-2xl p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/30"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Debt Cash Needed - 30 Days
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(snapshot.debtCashNeeded30d)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Debt-owned 30-day cash window.
          </p>
        </button>

        {snapshot.accountsRequiringReviewCount > 0 ? (
          <button
            type="button"
            onClick={onOpenNeedsReview}
            className="dashboard-shell-inner rounded-2xl p-4 text-left transition hover:border-slate-300 hover:bg-slate-50/80"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Accounts Requiring Review
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {snapshot.accountsRequiringReviewCount}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Verification or conflict signals are active.
            </p>
          </button>
        ) : null}
      </div>

      {hasTrustSignals ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700">
            <InfoBadge />
            Debt trust indicators
          </span>
          {snapshot.limitedConfidenceCount > 0 ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
              Limited {snapshot.limitedConfidenceCount}
            </span>
          ) : null}
          {snapshot.sourceConflictCount > 0 ? (
            <span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
              Source conflict {snapshot.sourceConflictCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function InfoBadge() {
  return <ShieldAlert className="h-3.5 w-3.5 text-blue-700" />;
}
