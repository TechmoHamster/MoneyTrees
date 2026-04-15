import { CalendarCheck2, X } from "lucide-react";
import type { DebtBillsPaymentStatus } from "@/lib/types";

type PaymentDetailsModalProps = {
  isOpen: boolean;
  targetCount: number;
  supportsDebtPaymentStatuses?: boolean;
  debtPaymentStatus: DebtBillsPaymentStatus;
  paidDate: string;
  paidAmount: string;
  paymentMethod: string;
  paymentNote: string;
  error: string;
  isSaving: boolean;
  onDebtPaymentStatusChange: (value: DebtBillsPaymentStatus) => void;
  onPaidDateChange: (value: string) => void;
  onPaidAmountChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onPaymentNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function PaymentDetailsModal({
  isOpen,
  targetCount,
  supportsDebtPaymentStatuses = false,
  debtPaymentStatus,
  paidDate,
  paidAmount,
  paymentMethod,
  paymentNote,
  error,
  isSaving,
  onDebtPaymentStatusChange,
  onPaidDateChange,
  onPaidAmountChange,
  onPaymentMethodChange,
  onPaymentNoteChange,
  onClose,
  onConfirm,
}: PaymentDetailsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/45 p-4">
      <section className="dashboard-shell w-[min(96vw,560px)] rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
              <CalendarCheck2 className="h-4 w-4 text-emerald-700" />
              Record Payment
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Apply payment details to {targetCount} selected bill{targetCount === 1 ? "" : "s"}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="dashboard-close-button dashboard-close-button-md"
            aria-label="Close payment details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {supportsDebtPaymentStatuses ? (
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                Debt Payment Status
              </span>
              <select
                value={debtPaymentStatus}
                onChange={(event) =>
                  onDebtPaymentStatusChange(event.target.value as DebtBillsPaymentStatus)
                }
                className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
              >
                <option value="paid">Completed</option>
                <option value="partially_paid">Partial Payment</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="reversed">Reversed</option>
                <option value="skipped_approved">Skipped Approved</option>
                <option value="canceled">Canceled</option>
              </select>
            </label>
          ) : null}

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              {supportsDebtPaymentStatuses ? "Event Date" : "Date Paid"}
            </span>
            <input
              type="date"
              value={paidDate}
              onChange={(event) => onPaidDateChange(event.target.value)}
              className="dashboard-control dashboard-date-control block h-11 w-full rounded-xl px-3 text-sm"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              {supportsDebtPaymentStatuses ? "Amount (Optional)" : "Amount Paid (Optional)"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={paidAmount}
              onChange={(event) => onPaidAmountChange(event.target.value)}
              className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
              placeholder="125.00"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              Payment Method (Optional)
            </span>
            <input
              type="text"
              value={paymentMethod}
              onChange={(event) => onPaymentMethodChange(event.target.value)}
              className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
              placeholder="Checking account"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              Payment Note (Optional)
            </span>
            <input
              type="text"
              value={paymentNote}
              onChange={(event) => onPaymentNoteChange(event.target.value)}
              className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
              placeholder="Paid via mobile app"
            />
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="dashboard-control inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 text-sm font-semibold text-white transition hover:from-emerald-800 hover:to-teal-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Payment"}
          </button>
        </div>
      </section>
    </div>
  );
}
