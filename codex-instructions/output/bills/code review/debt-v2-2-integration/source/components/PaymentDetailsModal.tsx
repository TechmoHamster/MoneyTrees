import { CalendarCheck2, X } from "lucide-react";

type PaymentDetailsModalProps = {
  isOpen: boolean;
  targetCount: number;
  paidDate: string;
  paidAmount: string;
  paymentMethod: string;
  paymentNote: string;
  error: string;
  isSaving: boolean;
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
  paidDate,
  paidAmount,
  paymentMethod,
  paymentNote,
  error,
  isSaving,
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
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              Date Paid
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
              Amount Paid (Optional)
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
