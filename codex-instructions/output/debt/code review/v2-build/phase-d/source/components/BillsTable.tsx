import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Download,
  FileJson2,
  FileSpreadsheet,
  Info,
  ListFilter,
  PencilLine,
  Rows4,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  BILL_CATEGORIES,
  BILL_STATUSES,
  type Bill,
  type BillCategory,
  type BillStatus,
  type DebtAccount,
  type RunningBalanceRow,
  type SortBy,
  type SortDirection,
} from "@/lib/types";
import { BillRow } from "@/components/BillRow";
import { formatCurrency, normalizeAmount, getBillLateFeeAmount, getBillTotalAmount } from "@/lib/utils";

type BillsTableProps = {
  bills: Bill[];
  runningBalances: RunningBalanceRow[];
  includePaidInTotals: boolean;
  statusFilter: BillStatus | "All";
  categoryFilter: BillCategory | "All";
  hasActiveFilters: boolean;
  balanceLeft: number;
  sortBy: SortBy;
  sortDirection: SortDirection;
  totalBillCount: number;
  visibleBillCount: number;
  searchQuery: string;
  onStatusFilterChange: (value: BillStatus | "All") => void;
  onCategoryFilterChange: (value: BillCategory | "All") => void;
  onSearchQueryChange: (value: string) => void;
  onSortByChange: (value: SortBy) => void;
  onSortDirectionChange: (value: SortDirection) => void;
  onClearViewFilters: () => void;
  onBackToCategoryBreakdown: () => void;
  onExportAllJson: () => void;
  onExportAllCsv: () => void;
  onExportViewCsv: () => void;
  onClearAll: () => void;
  onBulkStatusChange: (billIds: string[], status: BillStatus) => void;
  onBulkCategoryChange: (billIds: string[], category: BillCategory) => void;
  onBulkApplyLateFee: (billIds: string[], lateFeeAmount: number) => void;
  onBulkRemoveLateFee: (billIds: string[]) => void;
  onBulkRecordPayment: (billIds: string[]) => void;
  onBulkDelete: (billIds: string[]) => void;
  debtAccountsById: Map<string, DebtAccount>;
  onEdit: (bill: Bill) => void;
  onDelete: (billId: string) => void;
  onRecordPayment: (billIds: string[]) => void;
};

type BillGroup = {
  key: string;
  name: string;
  bills: Bill[];
  combinedAmount: number;
  lateFeeTotal: number;
  category: string;
  statusRundown: string;
};

const sortLabel: Record<SortBy, string> = {
  dueDate: "Due Date",
  status: "Status",
  category: "Category",
};

const STATUS_ORDER: BillStatus[] = ["Past Due", "Upcoming", "Paid"];

function getNameGroupKey(name: string): string {
  const normalized = name.trim().toLowerCase();
  return normalized.length > 0 ? normalized : "(unnamed)";
}

function buildStatusRundown(bills: Bill[]): string {
  const counts: Record<BillStatus, number> = {
    Upcoming: 0,
    "Past Due": 0,
    Paid: 0,
  };

  bills.forEach((bill) => {
    counts[bill.status] += 1;
  });

  return STATUS_ORDER.filter((status) => counts[status] > 0)
    .map((status) => `${counts[status]} ${status}`)
    .join(" • ");
}

export function BillsTable({
  bills,
  runningBalances,
  includePaidInTotals,
  statusFilter,
  categoryFilter,
  hasActiveFilters,
  balanceLeft,
  sortBy,
  sortDirection,
  totalBillCount,
  visibleBillCount,
  searchQuery,
  onStatusFilterChange,
  onCategoryFilterChange,
  onSearchQueryChange,
  onSortByChange,
  onSortDirectionChange,
  onClearViewFilters,
  onBackToCategoryBreakdown,
  onExportAllJson,
  onExportAllCsv,
  onExportViewCsv,
  onClearAll,
  onBulkStatusChange,
  onBulkCategoryChange,
  onBulkApplyLateFee,
  onBulkRemoveLateFee,
  onBulkRecordPayment,
  onBulkDelete,
  debtAccountsById,
  onEdit,
  onDelete,
  onRecordPayment,
}: BillsTableProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [groupByName, setGroupByName] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
  const [isBulkMenuMounted, setIsBulkMenuMounted] = useState(false);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<BillStatus>("Upcoming");
  const [bulkCategory, setBulkCategory] = useState<BillCategory>(BILL_CATEGORIES[0]);
  const [bulkLateFeeAmount, setBulkLateFeeAmount] = useState<string>("");
  const [bulkMenuPosition, setBulkMenuPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const bulkMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const bulkMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const bulkMenuCloseTimerRef = useRef<number | null>(null);
  const runningByBill = new Map(
    runningBalances.map((running) => [running.billId, running]),
  );

  const selectedExistingIds = useMemo(
    () => bills.filter((bill) => selectedBillIds.has(bill.id)).map((bill) => bill.id),
    [bills, selectedBillIds],
  );
  const selectedCount = selectedExistingIds.length;
  const selectedVisibleCount = selectedExistingIds.length;
  const allVisibleSelected = bills.length > 0 && selectedVisibleCount === bills.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasAnyViewFilter = hasActiveFilters || hasSearchQuery;
  const showBackToCategoryBreakdown =
    categoryFilter !== "All" && statusFilter === "All" && !hasSearchQuery;

  const groups = useMemo<BillGroup[]>(() => {
    const grouped = new Map<string, Bill[]>();
    bills.forEach((bill) => {
      const key = getNameGroupKey(bill.name);
      const existing = grouped.get(key) ?? [];
      existing.push(bill);
      grouped.set(key, existing);
    });

    return [...grouped.entries()].map(([key, groupedBills]) => {
      const uniqueCategories = new Set(groupedBills.map((bill) => bill.category));
      return {
        key,
        name: groupedBills[0]?.name ?? "Unnamed bill",
        bills: groupedBills,
        combinedAmount: groupedBills.reduce((sum, bill) => sum + getBillTotalAmount(bill), 0),
        lateFeeTotal: groupedBills.reduce((sum, bill) => sum + getBillLateFeeAmount(bill), 0),
        category:
          uniqueCategories.size === 1
            ? groupedBills[0]?.category ?? "Other"
            : "Mixed",
        statusRundown: buildStatusRundown(groupedBills),
      };
    });
  }, [bills]);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }

    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const clearBulkMenuTimer = useCallback(() => {
    if (bulkMenuCloseTimerRef.current !== null) {
      window.clearTimeout(bulkMenuCloseTimerRef.current);
      bulkMenuCloseTimerRef.current = null;
    }
  }, []);

  const clampBulkMenuToViewport = useCallback((nextTop: number, nextLeft: number) => {
    const viewportPadding = 8;
    const menuWidth = bulkMenuPanelRef.current?.offsetWidth ?? Math.min(256, window.innerWidth - 16);
    const menuHeight = bulkMenuPanelRef.current?.offsetHeight ?? 360;
    const clampedLeft = Math.min(
      Math.max(viewportPadding, nextLeft),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const clampedTop = Math.min(
      Math.max(viewportPadding, nextTop),
      window.innerHeight - menuHeight - viewportPadding,
    );

    return { top: clampedTop, left: clampedLeft };
  }, []);

  const openBulkMenu = useCallback(() => {
    if (bulkMenuTriggerRef.current) {
      const rect = bulkMenuTriggerRef.current.getBoundingClientRect();
      const rawTop = rect.bottom + 10;
      const rawLeft = rect.left;
      setBulkMenuPosition(clampBulkMenuToViewport(rawTop, rawLeft));
    }

    clearBulkMenuTimer();
    setIsBulkMenuMounted(true);
    requestAnimationFrame(() => {
      setIsBulkMenuOpen(true);
      requestAnimationFrame(() => {
        setBulkMenuPosition((previous) =>
          clampBulkMenuToViewport(previous.top, previous.left),
        );
      });
    });
  }, [clampBulkMenuToViewport, clearBulkMenuTimer]);

  const closeBulkMenu = useCallback(() => {
    setIsBulkMenuOpen(false);
    clearBulkMenuTimer();
    bulkMenuCloseTimerRef.current = window.setTimeout(() => {
      setIsBulkMenuMounted(false);
      bulkMenuCloseTimerRef.current = null;
    }, 160);
  }, [clearBulkMenuTimer]);

  const toggleBulkMenu = useCallback(() => {
    if (isBulkMenuMounted && isBulkMenuOpen) {
      closeBulkMenu();
      return;
    }
    openBulkMenu();
  }, [closeBulkMenu, isBulkMenuMounted, isBulkMenuOpen, openBulkMenu]);

  useEffect(() => {
    if (!isBulkMenuMounted) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const clickedTrigger = bulkMenuTriggerRef.current?.contains(target);
      const clickedMenu = bulkMenuPanelRef.current?.contains(target);
      if (!clickedTrigger && !clickedMenu) {
        closeBulkMenu();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeBulkMenu();
      }
    }

    function handleWindowResizeOrScroll() {
      closeBulkMenu();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleWindowResizeOrScroll);
    window.addEventListener("scroll", handleWindowResizeOrScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleWindowResizeOrScroll);
      window.removeEventListener("scroll", handleWindowResizeOrScroll, true);
    };
  }, [closeBulkMenu, isBulkMenuMounted]);

  useEffect(() => {
    return () => clearBulkMenuTimer();
  }, [clearBulkMenuTimer]);

  function handleSelectAllVisible(next: boolean) {
    setSelectedBillIds((previous) => {
      const updated = new Set(previous);
      if (next) {
        bills.forEach((bill) => updated.add(bill.id));
      } else {
        bills.forEach((bill) => updated.delete(bill.id));
      }
      return updated;
    });
  }

  function handleSelectBill(billId: string, next: boolean) {
    setSelectedBillIds((previous) => {
      const updated = new Set(previous);
      if (next) {
        updated.add(billId);
      } else {
        updated.delete(billId);
      }
      return updated;
    });
  }

  function handleSelectGroup(groupBills: Bill[], next: boolean) {
    setSelectedBillIds((previous) => {
      const updated = new Set(previous);
      groupBills.forEach((bill) => {
        if (next) {
          updated.add(bill.id);
        } else {
          updated.delete(bill.id);
        }
      });
      return updated;
    });
  }

  function handleToggleGroup(groupKey: string) {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  function handleBulkStatus(status: BillStatus) {
    if (selectedCount === 0) {
      return;
    }
    if (status === "Paid") {
      onBulkRecordPayment(selectedExistingIds);
      closeBulkMenu();
      return;
    }

    onBulkStatusChange(selectedExistingIds, status);
    closeBulkMenu();
  }

  function handleBulkStatusApply() {
    handleBulkStatus(bulkStatus);
  }

  function handleBulkRecordPayment() {
    if (selectedCount === 0) {
      return;
    }
    onBulkRecordPayment(selectedExistingIds);
    closeBulkMenu();
  }

  function handleBulkApplyLateFee() {
    if (selectedCount === 0) {
      return;
    }

    const parsed = Number.parseFloat(bulkLateFeeAmount);
    const normalized = normalizeAmount(parsed);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return;
    }

    onBulkApplyLateFee(selectedExistingIds, normalized);
    setBulkLateFeeAmount("");
    closeBulkMenu();
  }

  function handleBulkRemoveLateFee() {
    if (selectedCount === 0) {
      return;
    }
    onBulkRemoveLateFee(selectedExistingIds);
    closeBulkMenu();
  }

  function handleBulkCategoryApply() {
    if (selectedCount === 0) {
      return;
    }
    onBulkCategoryChange(selectedExistingIds, bulkCategory);
    closeBulkMenu();
  }

  function handleBulkDeleteApply() {
    if (selectedCount === 0) {
      return;
    }
    onBulkDelete(selectedExistingIds);
    setSelectedBillIds((previous) => {
      const updated = new Set(previous);
      selectedExistingIds.forEach((billId) => updated.delete(billId));
      return updated;
    });
    closeBulkMenu();
  }

  return (
    <section
      id="bills-audit-section"
      className="dashboard-shell dashboard-shell-table rounded-3xl p-5 sm:p-6"
    >
      <div className="space-y-4">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Table2 className="h-4 w-4 text-blue-700" />
            Bills Table
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Search, sort, group, and bulk-update the same tracked bill data in one place.
          </p>
          {hasAnyViewFilter ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">
                Viewing:
              </p>
              {statusFilter !== "All" ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  Status {statusFilter}
                </span>
              ) : null}
              {categoryFilter !== "All" ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  Category {categoryFilter}
                </span>
              ) : null}
              {hasSearchQuery ? (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  Search “{searchQuery.trim()}”
                </span>
              ) : null}
              <button
                type="button"
                onClick={
                  showBackToCategoryBreakdown
                    ? onBackToCategoryBreakdown
                    : onClearViewFilters
                }
                className="dashboard-control rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {showBackToCategoryBreakdown
                  ? "Back To Category Breakdown"
                  : "Clear View Filters"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="dashboard-shell-inner rounded-2xl p-3 sm:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                View Controls
              </p>
              <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInfo((previous) => !previous)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Info className="h-3.5 w-3.5" />
                {showInfo ? "Hide Info" : "Show Info"}
                {showInfo ? (
                  <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              <label className="inline-flex items-center gap-2 rounded-md px-1.5 py-1">
                <span className="text-xs font-semibold text-slate-600">
                  Grouped View
                </span>
                <button
                  type="button"
                  onClick={() => setGroupByName((previous) => !previous)}
                  className={`relative h-6 w-12 overflow-hidden rounded-full border shadow-[inset_0_2px_5px_rgba(15,23,42,0.16)] transition ${
                    groupByName
                      ? "border-blue-800 bg-gradient-to-r from-blue-700 to-indigo-700"
                      : "border-slate-400 bg-slate-300"
                  }`}
                  aria-pressed={groupByName}
                  aria-label="Toggle grouped view"
                >
                  <span
                    className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(15,23,42,0.3)] transition-[left,transform] duration-200"
                    style={{
                      left: groupByName
                        ? "calc(100% - 1rem - 0.25rem)"
                        : "0.25rem",
                    }}
                  />
                </button>
              </label>
            </div>
            </div>

            <div className="space-y-2 xl:max-w-[36rem] xl:items-end">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 xl:text-right">
                Actions
              </p>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <div className="relative">
                  <button
                    ref={bulkMenuTriggerRef}
                    type="button"
                    onClick={toggleBulkMenu}
                    className="dashboard-control inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    Bulk Actions ({selectedCount})
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${
                        isBulkMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isBulkMenuMounted
                    ? createPortal(
                        <div
                          ref={bulkMenuPanelRef}
                          className={`fixed z-[85] w-[min(16rem,calc(100vw-1rem))] origin-top-left rounded-xl border border-slate-300 bg-white p-2 shadow-[0_24px_45px_-25px_rgba(15,23,42,0.75)] transition duration-150 ${
                            isBulkMenuOpen
                              ? "translate-y-0 scale-100 opacity-100"
                              : "-translate-y-1 scale-95 opacity-0"
                          }`}
                          style={{
                            top: `${bulkMenuPosition.top}px`,
                            left: `${bulkMenuPosition.left}px`,
                            maxHeight: "calc(100vh - 16px)",
                          }}
                        >
                      <div className="mb-1.5 flex items-center justify-between px-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                          {selectedCount} selected
                        </p>
                        <button
                          type="button"
                          onClick={closeBulkMenu}
                          className="dashboard-close-button dashboard-close-button-sm"
                          aria-label="Close bulk actions menu"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2 space-y-1">
                        <button
                          type="button"
                          disabled={selectedCount === 0}
                          onClick={handleBulkRecordPayment}
                          className="inline-flex w-full items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Selected Paid
                        </button>
                      </div>

                  <div className="mt-2 space-y-1">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Change Status
                    </p>
                    <select
                      value={bulkStatus}
                      onChange={(event) => setBulkStatus(event.target.value as BillStatus)}
                      className="dashboard-control h-9 w-full rounded-md px-2 text-xs"
                    >
                      {BILL_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={handleBulkStatusApply}
                      className="inline-flex w-full items-center justify-center rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Apply Status
                    </button>
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Category
                    </p>
                    <select
                      value={bulkCategory}
                      onChange={(event) =>
                        setBulkCategory(event.target.value as BillCategory)
                      }
                      className="dashboard-control h-9 w-full rounded-md px-2 text-xs"
                    >
                      {BILL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={handleBulkCategoryApply}
                      className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                    >
                      Apply Category
                    </button>
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Applied Late Fee
                    </p>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkLateFeeAmount}
                      onChange={(event) => setBulkLateFeeAmount(event.target.value)}
                      className="dashboard-control h-9 w-full rounded-md px-2 text-xs"
                      placeholder="0.00"
                    />
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        disabled={selectedCount === 0}
                        onClick={handleBulkApplyLateFee}
                        className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        Apply Fee
                      </button>
                      <button
                        type="button"
                        disabled={selectedCount === 0}
                        onClick={handleBulkRemoveLateFee}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        Remove Fee
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedBillIds(new Set())}
                      className="dashboard-control inline-flex flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={handleBulkDeleteApply}
                      className="dashboard-control inline-flex flex-1 items-center justify-center rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      Delete Selected
                    </button>
                  </div>
                        </div>,
                        document.body,
                      )
                    : null}
                </div>

                <button
                  type="button"
                  onClick={onExportAllCsv}
                  disabled={totalBillCount === 0}
                  className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-700 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Export All CSV
                </button>
                <button
                  type="button"
                  onClick={onExportViewCsv}
                  disabled={visibleBillCount === 0}
                  className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Export View CSV
                </button>
                <button
                  type="button"
                  onClick={onExportAllJson}
                  disabled={totalBillCount === 0}
                  className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
                >
                  <FileJson2 className="h-4 w-4" />
                  JSON
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={totalBillCount === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {showInfo ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-800">
              Running balances always follow the full sorted bill sequence, while
              filters only hide rows. Paid bills stay visible and are{" "}
              {includePaidInTotals ? "currently included" : "currently excluded"} in
              active totals. Remaining balance: {formatCurrency(balanceLeft)}.
            </p>
          ) : null}

        </div>

        <div className="dashboard-shell-inner rounded-2xl p-3 sm:p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Data Controls
          </p>
          <label className="mb-3 block space-y-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <Search className="h-3.5 w-3.5" />
              Search Bills
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search by bill name, notes, category, or payment method..."
              className="dashboard-control h-10 w-full rounded-xl px-3 text-sm"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ListFilter className="h-3.5 w-3.5" />
                Filter Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  onStatusFilterChange(event.target.value as BillStatus | "All")
                }
                className="dashboard-control h-10 w-full min-w-[9rem] rounded-xl px-3 text-sm"
              >
                <option value="All">All</option>
                {BILL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ListFilter className="h-3.5 w-3.5" />
                Filter Category
              </span>
              <select
                value={categoryFilter}
                onChange={(event) =>
                  onCategoryFilterChange(event.target.value as BillCategory | "All")
                }
                className="dashboard-control h-10 w-full min-w-[9rem] rounded-xl px-3 text-sm"
              >
                <option value="All">All</option>
                {BILL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <Rows4 className="h-3.5 w-3.5" />
                Sort By
              </span>
              <select
                value={sortBy}
                onChange={(event) => onSortByChange(event.target.value as SortBy)}
                className="dashboard-control h-10 w-full min-w-[9rem] rounded-xl px-3 text-sm"
              >
                {(Object.keys(sortLabel) as SortBy[]).map((sortKey) => (
                  <option key={sortKey} value={sortKey}>
                    {sortLabel[sortKey]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Direction
              </span>
              <select
                value={sortDirection}
                onChange={(event) =>
                  onSortDirectionChange(event.target.value as SortDirection)
                }
                className="dashboard-control h-10 w-full min-w-[9rem] rounded-xl px-3 text-sm"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-300/75 bg-white shadow-[0_12px_24px_-22px_rgba(15,23,42,0.45)]">
        <table className="min-w-[1080px] w-full border-collapse">
          <thead className="bg-slate-900 text-left text-[11px] uppercase tracking-[0.16em] text-slate-100">
            <tr>
              <th className="px-4 py-3.5">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => handleSelectAllVisible(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-400 text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  aria-label="Select all visible bills"
                />
              </th>
              <th className="px-4 py-3.5">Bill Name</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Due Date</th>
              <th className="px-4 py-3.5 text-right">Amount</th>
              <th className="px-4 py-3.5 text-right">Running Total</th>
              <th className="px-4 py-3.5 text-right">Remaining Balance</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/85">
            {bills.length === 0 ? (
              <tr>
                <td className="px-4 py-12" colSpan={9}>
                  <div className="dashboard-empty-state mx-auto max-w-xl rounded-2xl px-5 py-6 text-center">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Table2 className="h-4 w-4 text-blue-700" />
                      No rows in this table view
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {hasAnyViewFilter
                        ? hasSearchQuery
                          ? "No bills match the current filters and search query. Clear or adjust your view filters."
                          : "No bills match the current filters. Clear or adjust filters to see hidden rows."
                        : "No bills match this view yet. Add a bill above to begin auditing."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : groupByName ? (
              groups.map((group) => {
                const groupIds = group.bills.map((bill) => bill.id);
                const selectedInGroup = groupIds.filter((id) =>
                  selectedBillIds.has(id),
                ).length;
                const allGroupSelected =
                  groupIds.length > 0 && selectedInGroup === groupIds.length;
                const someGroupSelected = selectedInGroup > 0 && !allGroupSelected;
                const isExpanded = expandedGroups.has(group.key);

                return (
                  <Fragment key={group.key}>
                    <tr className="bg-slate-100/90">
                      <td className="px-4 py-3.5 align-middle">
                        <input
                          type="checkbox"
                          checked={allGroupSelected}
                          ref={(element) => {
                            if (element) {
                              element.indeterminate = someGroupSelected;
                            }
                          }}
                          onChange={(event) =>
                            handleSelectGroup(group.bills, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-400 text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          aria-label={`Select group ${group.name}`}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(group.key)}
                          className="inline-flex items-center gap-1.5 font-semibold text-slate-900 transition hover:text-blue-800"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {group.name}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-sm font-medium text-slate-700">
                        {group.category}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-sm text-slate-700">
                        {group.statusRundown}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-sm text-slate-700">
                        {group.bills.length} entr{group.bills.length === 1 ? "y" : "ies"}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-right text-sm font-semibold text-slate-900">
                        <p>Total: {formatCurrency(group.combinedAmount)}</p>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          Includes late fees: {formatCurrency(group.lateFeeTotal)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-right text-sm text-slate-500">
                        —
                      </td>
                      <td className="px-4 py-3.5 align-middle text-right text-sm text-slate-500">
                        —
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectGroup(group.bills, true)}
                            className="dashboard-control inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Select Group
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectGroup(group.bills, true);
                              openBulkMenu();
                            }}
                            className="dashboard-control inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            Group Actions
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded
                      ? group.bills.map((bill) => {
                          const runningBalance = runningByBill.get(bill.id);
                          if (!runningBalance) {
                            return null;
                          }

                          return (
                            <BillRow
                              key={bill.id}
                              bill={bill}
                              linkedDebtAccount={
                                bill.sourceDebtAccountId
                                  ? debtAccountsById.get(bill.sourceDebtAccountId)
                                  : undefined
                              }
                              runningBalance={runningBalance}
                              includePaidInTotals={includePaidInTotals}
                              isSelected={selectedBillIds.has(bill.id)}
                              onToggleSelect={handleSelectBill}
                              isGroupedChild
                              onEdit={onEdit}
                              onDelete={onDelete}
                              onRecordPayment={onRecordPayment}
                            />
                          );
                        })
                      : null}
                  </Fragment>
                );
              })
            ) : (
              bills.map((bill) => {
                const runningBalance = runningByBill.get(bill.id);
                if (!runningBalance) {
                  return null;
                }

                return (
                  <BillRow
                    key={bill.id}
                    bill={bill}
                    linkedDebtAccount={
                      bill.sourceDebtAccountId
                        ? debtAccountsById.get(bill.sourceDebtAccountId)
                        : undefined
                    }
                    runningBalance={runningBalance}
                    includePaidInTotals={includePaidInTotals}
                    isSelected={selectedBillIds.has(bill.id)}
                    onToggleSelect={handleSelectBill}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onRecordPayment={onRecordPayment}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
