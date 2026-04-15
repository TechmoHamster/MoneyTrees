"use client";

import {
  LogOut,
  Layers,
  Bot,
  X,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Table2,
  Rows4,
  ChartNoAxesCombined,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { AdvisorHubSection } from "@/components/AdvisorHubSection";
import { BalanceHeader } from "@/components/BalanceHeader";
import { BillForm } from "@/components/BillForm";
import { BillsTable } from "@/components/BillsTable";
import { DebtOverviewSnapshotSection } from "@/components/DebtOverviewSnapshotSection";
import { DebtSection } from "@/components/DebtSection";
import { MfaSettings } from "@/components/MfaSettings";
import { PaymentDetailsModal } from "@/components/PaymentDetailsModal";
import { ReportingSection } from "@/components/ReportingSection";
import { SmartInsightsSection } from "@/components/SmartInsightsSection";
import { SummaryCards } from "@/components/SummaryCards";
import { UpcomingBillsSection } from "@/components/UpcomingBillsSection";
import { UserAvatar } from "@/components/UserAvatar";
import type { AdvisorHubResponse, AdvisorResponse } from "@/lib/advisor-contracts";
import { createAvatarSeed } from "@/lib/avatar";
import { getCsrfRequestHeaders } from "@/lib/client-security";
import {
  buildDebtOverviewSnapshot,
  buildDebtReportingSnapshot,
  buildDebtDownstreamSnapshot,
  calculateDebtSummary,
  mergeDebtBills,
} from "@/lib/debt";
import {
  billMatchesSearchQuery,
  buildSmartInsights,
  calculateReportingSnapshot,
  calculateRunningBalances,
  calculateSummary,
  buildCsv,
  getTodayDateString,
  getUpcomingBills,
  normalizeAmount,
  sortBills,
} from "@/lib/utils";
import type {
  AdvisorAction,
  AdvisorPreference,
  AdvisorContext,
  AdvisorWorkspaceState,
  AdvisorItem,
  AdvisorScenarioResult,
  Bill,
  BillCategory,
  DashboardState,
  BillInput,
  BillStatus,
  DebtAccount,
  ReportingRange,
  SortBy,
  SortDirection,
} from "@/lib/types";

const INITIAL_STARTING_BALANCE = 1070;
const UI_SECTIONS_STORAGE_KEY = "finance-dashboard-ui-sections-v1";
const DASHBOARD_VIEW_STORAGE_KEY = "finance-dashboard-active-view-v1";
const REPORTING_RANGE_STORAGE_KEY = "finance-dashboard-reporting-range-v1";
const BILL_FORM_EXPANDED_STORAGE_KEY = "finance-dashboard-bill-form-expanded-v1";
const DEFAULT_ADVISOR_PREFERENCE: AdvisorPreference = {
  strategy: "reduce-overdue-count",
  minimumCashBuffer: 200,
};

type UiSectionVisibility = {
  dueSoon: boolean;
  lateFees: boolean;
  upcoming: boolean;
  insights: boolean;
  categoryChart: boolean;
};

type DashboardView =
  | "overview"
  | "planning"
  | "audit"
  | "debt"
  | "reporting"
  | "advisor"
  | "all";
type AdvisorActionSource = {
  kind: "recommendation" | "scenario";
  id: string;
  label: string;
  focusBillId?: string;
  focusCategory?: BillCategory;
  recommendationType?: AdvisorItem["recommendationType"];
  priority?: AdvisorItem["priority"];
  whyNow?: string;
  scenarioType?: AdvisorScenarioResult["type"];
  scenarioPriority?: AdvisorScenarioResult["priority"];
  scenarioBestFor?: string;
  scenarioTradeoffSummary?: string;
};

type CategoryDrilldownOrigin = {
  view: DashboardView;
  sectionId: string;
};

function mapAdvisorContextToDashboardView(context: AdvisorContext): DashboardView {
  switch (context) {
    case "overview":
      return "overview";
    case "planning":
      return "planning";
    case "reporting":
      return "reporting";
    case "all":
    default:
      return "all";
  }
}

const DEFAULT_UI_SECTION_VISIBILITY: UiSectionVisibility = {
  dueSoon: false,
  lateFees: false,
  upcoming: false,
  insights: false,
  categoryChart: true,
};

const DASHBOARD_VIEWS: Array<{
  id: DashboardView;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    id: "overview",
    label: "Overview",
    hint: "Balances, KPIs, chart, and insights",
    icon: LayoutDashboard,
  },
  {
    id: "planning",
    label: "Bills",
    hint: "Add, edit, search, sort, and bulk actions",
    icon: Table2,
  },
  {
    id: "debt",
    label: "Debt",
    hint: "Account truth, debt math, and schedule visibility",
    icon: Layers,
  },
  {
    id: "reporting",
    label: "Reporting",
    hint: "Analyze totals, trends, and period deltas",
    icon: ChartNoAxesCombined,
  },
  {
    id: "advisor",
    label: "Advisor",
    hint: "Hub for deeper guidance, trust, and history",
    icon: Bot,
  },
  {
    id: "all",
    label: "All",
    hint: "Show all sections together",
    icon: Rows4,
  },
];

function createBillId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function downloadFile(filename: string, content: string, mimeType: string): void {
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

export function FinanceDashboard() {
  const [startingBalance, setStartingBalance] = useState<number>(
    INITIAL_STARTING_BALANCE,
  );
  const [includePaidInTotals, setIncludePaidInTotals] = useState<boolean>(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [debtAccounts, setDebtAccounts] = useState<DebtAccount[]>([]);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [accountAvatarEnabled, setAccountAvatarEnabled] = useState(false);
  const [accountAvatarSeed, setAccountAvatarSeed] = useState("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountFormName, setAccountFormName] = useState("");
  const [accountFormEmail, setAccountFormEmail] = useState("");
  const [accountFormAvatarEnabled, setAccountFormAvatarEnabled] = useState(false);
  const [accountFormAvatarSeed, setAccountFormAvatarSeed] = useState("");
  const [accountCurrentPassword, setAccountCurrentPassword] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [welcomeExiting, setWelcomeExiting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<BillStatus | "All">("All");
  const [categoryFilter, setCategoryFilter] = useState<BillCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [paymentTargetBillIds, setPaymentTargetBillIds] = useState<string[]>([]);
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [uiSectionVisibility, setUiSectionVisibility] = useState<UiSectionVisibility>(
    DEFAULT_UI_SECTION_VISIBILITY,
  );
  const [activeDashboardView, setActiveDashboardView] =
    useState<DashboardView>("overview");
  const [reportingRange, setReportingRange] = useState<ReportingRange>("month");
  const [isBillFormExpanded, setIsBillFormExpanded] = useState(true);
  const [advisorPreference, setAdvisorPreference] = useState<AdvisorPreference>(
    DEFAULT_ADVISOR_PREFERENCE,
  );
  const [advisorWorkspace, setAdvisorWorkspace] = useState<AdvisorWorkspaceState | undefined>(
    undefined,
  );
  const [advisorResponse, setAdvisorResponse] = useState<AdvisorResponse | null>(null);
  const [advisorHubData, setAdvisorHubData] = useState<AdvisorHubResponse | null>(null);
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [isAdvisorRunning, setIsAdvisorRunning] = useState(false);
  const [advisorError, setAdvisorError] = useState("");
  const [lastPersistedDashboardKey, setLastPersistedDashboardKey] = useState("");
  const [lastPersistedMaterialDashboardKey, setLastPersistedMaterialDashboardKey] = useState("");
  const [walkthroughReturnView, setWalkthroughReturnView] = useState<DashboardView | null>(null);
  const [categoryDrilldownOrigin, setCategoryDrilldownOrigin] =
    useState<CategoryDrilldownOrigin | null>(null);
  const [focusedDebtAccountId, setFocusedDebtAccountId] = useState<string | null>(null);

  const materialDashboardPayload = useMemo(
    () => ({
      startingBalance,
      includePaidInTotals,
      bills,
      debtAccounts,
    }),
    [bills, debtAccounts, includePaidInTotals, startingBalance],
  );
  const materialDashboardKey = useMemo(
    () => JSON.stringify(materialDashboardPayload),
    [materialDashboardPayload],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadFromServer() {
      try {
        const response = await fetch("/api/dashboard", {
          method: "GET",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load dashboard.");
        }

        const state = (await response.json()) as DashboardState;
        if (!isCancelled) {
          setStartingBalance(state.startingBalance);
          setIncludePaidInTotals(state.includePaidInTotals);
          setBills(state.bills);
          setDebtAccounts(state.debtAccounts ?? []);
          setAdvisorWorkspace(state.advisorWorkspace);
          setLastPersistedDashboardKey(
            JSON.stringify({
              startingBalance: state.startingBalance,
              includePaidInTotals: state.includePaidInTotals,
              bills: state.bills,
              debtAccounts: state.debtAccounts ?? [],
              advisorWorkspace: state.advisorWorkspace,
            }),
          );
          setLastPersistedMaterialDashboardKey(
            JSON.stringify({
              startingBalance: state.startingBalance,
              includePaidInTotals: state.includePaidInTotals,
              bills: state.bills,
              debtAccounts: state.debtAccounts ?? [],
            }),
          );
        }
      } catch {
        if (!isCancelled) {
          setLoadError("Unable to load saved dashboard data.");
        }
      } finally {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      }
    }

    void loadFromServer();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadAccount() {
      try {
        const response = await fetch("/api/account", {
          method: "GET",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          id: string;
          email: string;
          displayName?: string;
          avatarEnabled?: boolean;
          avatarSeed?: string;
        };
        if (!isCancelled) {
          setAccountId(data.id);
          setAccountEmail(data.email);
          setAccountDisplayName(data.displayName ?? "");
          setAccountAvatarEnabled(data.avatarEnabled ?? false);
          setAccountAvatarSeed(data.avatarSeed ?? "");
        }
      } catch {
        // Non-blocking: dashboard can still load even if profile fetch fails.
      }
    }

    void loadAccount();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") !== "1") {
      return;
    }

    setShowWelcomeSplash(true);
    params.delete("welcome");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!showWelcomeSplash) {
      return;
    }

    const startExitTimer = window.setTimeout(() => {
      setWelcomeExiting(true);
    }, 1250);

    const hideTimer = window.setTimeout(() => {
      setShowWelcomeSplash(false);
      setWelcomeExiting(false);
    }, 1600);

    return () => {
      window.clearTimeout(startExitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [showWelcomeSplash]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(UI_SECTIONS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<UiSectionVisibility>;
      setUiSectionVisibility({
        dueSoon: typeof parsed.dueSoon === "boolean" ? parsed.dueSoon : DEFAULT_UI_SECTION_VISIBILITY.dueSoon,
        lateFees: typeof parsed.lateFees === "boolean" ? parsed.lateFees : DEFAULT_UI_SECTION_VISIBILITY.lateFees,
        upcoming: typeof parsed.upcoming === "boolean" ? parsed.upcoming : DEFAULT_UI_SECTION_VISIBILITY.upcoming,
        insights: typeof parsed.insights === "boolean" ? parsed.insights : DEFAULT_UI_SECTION_VISIBILITY.insights,
        categoryChart:
          typeof parsed.categoryChart === "boolean"
            ? parsed.categoryChart
            : DEFAULT_UI_SECTION_VISIBILITY.categoryChart,
      });
    } catch {
      // Keep defaults when ui preference cache cannot be parsed.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      UI_SECTIONS_STORAGE_KEY,
      JSON.stringify(uiSectionVisibility),
    );
  }, [uiSectionVisibility]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY);
      if (!raw) {
        return;
      }

      if (
        raw === "overview" ||
        raw === "planning" ||
        raw === "audit" ||
        raw === "debt" ||
        raw === "advisor" ||
        raw === "reporting" ||
        raw === "all"
      ) {
        setActiveDashboardView(raw === "audit" ? "planning" : raw);
      }
    } catch {
      // Ignore malformed or unavailable localStorage values.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, activeDashboardView);
  }, [activeDashboardView]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BILL_FORM_EXPANDED_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { expanded?: boolean };
      if (typeof parsed.expanded === "boolean") {
        setIsBillFormExpanded(parsed.expanded);
      }
    } catch {
      // Ignore malformed values and retain defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      BILL_FORM_EXPANDED_STORAGE_KEY,
      JSON.stringify({ expanded: isBillFormExpanded }),
    );
  }, [isBillFormExpanded]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REPORTING_RANGE_STORAGE_KEY);
      if (!raw) {
        return;
      }

      if (raw === "day" || raw === "week" || raw === "month" || raw === "year") {
        setReportingRange(raw);
      }
    } catch {
      // Ignore malformed values and retain defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(REPORTING_RANGE_STORAGE_KEY, reportingRange);
  }, [reportingRange]);

  const dashboardPersistencePayload = useMemo<DashboardState>(
    () => ({
      startingBalance,
      includePaidInTotals,
      bills,
      debtAccounts,
      advisorWorkspace,
    }),
    [advisorWorkspace, bills, debtAccounts, includePaidInTotals, startingBalance],
  );
  const dashboardPersistenceKey = useMemo(
    () => JSON.stringify(dashboardPersistencePayload),
    [dashboardPersistencePayload],
  );

  const saveDashboardState = useCallback(async (payload: DashboardState): Promise<boolean> => {
    try {
      const response = await fetch("/api/dashboard", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfRequestHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return false;
      }

      setLastPersistedDashboardKey(JSON.stringify(payload));
      setLastPersistedMaterialDashboardKey(
        JSON.stringify({
          startingBalance: payload.startingBalance,
          includePaidInTotals: payload.includePaidInTotals,
          bills: payload.bills,
          debtAccounts: payload.debtAccounts ?? [],
        }),
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  const ensureDashboardStatePersisted = useCallback(async (): Promise<void> => {
    if (dashboardPersistenceKey === lastPersistedDashboardKey) {
      return;
    }

    await saveDashboardState(dashboardPersistencePayload);
  }, [
    dashboardPersistenceKey,
    dashboardPersistencePayload,
    lastPersistedDashboardKey,
    saveDashboardState,
  ]);

  const persistAdvisorWorkspace = useCallback(
    (
      updater: (
        previous: AdvisorWorkspaceState | undefined,
      ) => AdvisorWorkspaceState | undefined,
    ) => {
      let nextWorkspace: AdvisorWorkspaceState | undefined;
      setAdvisorWorkspace((previous) => {
        nextWorkspace = updater(previous);
        return nextWorkspace;
      });

      if (typeof nextWorkspace !== "undefined") {
        void saveDashboardState({
          startingBalance,
          includePaidInTotals,
          bills,
          debtAccounts,
          advisorWorkspace: nextWorkspace,
        });
      }
    },
    [bills, debtAccounts, includePaidInTotals, saveDashboardState, startingBalance],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const timer = window.setTimeout(() => {
      void saveDashboardState(dashboardPersistencePayload);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dashboardPersistencePayload, isHydrated, saveDashboardState]);

  const ledgerBills = useMemo(
    () => mergeDebtBills(bills, debtAccounts),
    [bills, debtAccounts],
  );

  const debtSummary = useMemo(
    () => calculateDebtSummary(debtAccounts, ledgerBills),
    [debtAccounts, ledgerBills],
  );
  const debtDownstreamSnapshot = useMemo(
    () => buildDebtDownstreamSnapshot(debtAccounts, ledgerBills),
    [debtAccounts, ledgerBills],
  );
  const debtOverviewSnapshot = useMemo(
    () => buildDebtOverviewSnapshot(debtDownstreamSnapshot),
    [debtDownstreamSnapshot],
  );
  const debtReportingSnapshot = useMemo(
    () => buildDebtReportingSnapshot(debtDownstreamSnapshot, reportingRange),
    [debtDownstreamSnapshot, reportingRange],
  );
  const debtAccountsById = useMemo(
    () => new Map(debtAccounts.map((account) => [account.id, account])),
    [debtAccounts],
  );

  const summary = useMemo(
    () => calculateSummary(ledgerBills, startingBalance, includePaidInTotals),
    [includePaidInTotals, ledgerBills, startingBalance],
  );

  const sortedBills = useMemo(
    () => sortBills(ledgerBills, sortBy, sortDirection),
    [ledgerBills, sortBy, sortDirection],
  );

  const visibleBills = useMemo(() => {
    return sortedBills.filter((bill) => {
      const statusMatches = statusFilter === "All" || bill.status === statusFilter;
      const categoryMatches =
        categoryFilter === "All" || bill.category === categoryFilter;
      const searchMatches = billMatchesSearchQuery(bill, searchQuery);

      return statusMatches && categoryMatches && searchMatches;
    });
  }, [categoryFilter, searchQuery, sortedBills, statusFilter]);

  const runningBalances = useMemo(
    () => calculateRunningBalances(sortedBills, startingBalance, includePaidInTotals),
    [includePaidInTotals, sortedBills, startingBalance],
  );
  const upcomingBills = useMemo(() => getUpcomingBills(ledgerBills, 6), [ledgerBills]);
  const smartInsights = useMemo(
    () => buildSmartInsights(ledgerBills, summary, includePaidInTotals),
    [includePaidInTotals, ledgerBills, summary],
  );
  const reportingSnapshot = useMemo(
    () => calculateReportingSnapshot(ledgerBills, reportingRange),
    [ledgerBills, reportingRange],
  );
  const smartInsightsCompact = useMemo(() => smartInsights.slice(0, 3), [smartInsights]);

  const advisorContext: AdvisorContext =
    activeDashboardView === "planning" || activeDashboardView === "audit"
      ? "planning"
      : activeDashboardView === "overview"
        ? "overview"
        : activeDashboardView === "reporting"
          ? "reporting"
          : "all";

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let isCancelled = false;

    async function loadAdvisorSnapshot() {
      setIsAdvisorLoading(true);
      setAdvisorError("");

      try {
        const query = new URLSearchParams({
          context: activeDashboardView === "advisor" ? "all" : advisorContext,
          reportingRange,
        });
        const endpoint =
          activeDashboardView === "advisor" ? "/api/advisor/hub" : "/api/advisor";
        const response = await fetch(`${endpoint}?${query.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load advisor state.");
        }

        const payload = (await response.json()) as
          | {
              preference: AdvisorPreference;
              response: AdvisorResponse | null;
            }
          | {
              preference: AdvisorPreference;
              hub: AdvisorHubResponse;
            };

        if (!isCancelled) {
          setAdvisorPreference(payload.preference);
          if ("response" in payload) {
            setAdvisorResponse(payload.response);
            setAdvisorHubData(null);
          } else {
            setAdvisorResponse(payload.hub.latestAnalysis);
            setAdvisorHubData(payload.hub);
          }
        }
      } catch {
        if (!isCancelled) {
          setAdvisorError("Unable to load advisor state.");
        }
      } finally {
        if (!isCancelled) {
          setIsAdvisorLoading(false);
        }
      }
    }

    void loadAdvisorSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [activeDashboardView, advisorContext, isHydrated, reportingRange]);

  useEffect(() => {
    if (!advisorResponse) {
      return;
    }

    if (materialDashboardKey === lastPersistedMaterialDashboardKey) {
      return;
    }

    setAdvisorResponse((previous) =>
      previous
        ? {
            ...previous,
            metadata: {
              ...previous.metadata,
              cacheStatus: "stale",
              stale: true,
            },
          }
        : previous,
    );
    setAdvisorHubData((previous) =>
      previous
        ? {
            ...previous,
            latestAnalysis: previous.latestAnalysis
              ? {
                  ...previous.latestAnalysis,
                  metadata: {
                    ...previous.latestAnalysis.metadata,
                    cacheStatus: "stale",
                    stale: true,
                  },
                }
              : previous.latestAnalysis,
          }
        : previous,
    );
  }, [advisorResponse, lastPersistedMaterialDashboardKey, materialDashboardKey]);

  const editingBill = useMemo(
    () => ledgerBills.find((bill) => bill.id === editingBillId) ?? null,
    [editingBillId, ledgerBills],
  );
  const hasActiveFilters = statusFilter !== "All" || categoryFilter !== "All";

  const upsertBillRecords = useCallback(
    (
      billIds: string[],
      updater: (bill: Bill) => Bill,
      options?: { allowDerivedCreation?: boolean; remove?: boolean },
    ) => {
      const targetIds = new Set(billIds);
      setBills((previous) => {
        const mergedById = new Map(ledgerBills.map((bill) => [bill.id, bill]));
        let next = previous.map((bill) =>
          targetIds.has(bill.id) ? updater(bill) : bill,
        );

        if (options?.allowDerivedCreation) {
          const existingIds = new Set(next.map((bill) => bill.id));
          for (const billId of billIds) {
            if (existingIds.has(billId)) {
              continue;
            }
            const bill = mergedById.get(billId);
            if (!bill || bill.sourceType !== "debt-derived") {
              continue;
            }
            next = [updater(bill), ...next];
          }
        }

        if (options?.remove) {
          next = next.filter((bill) => !targetIds.has(bill.id));
        }

        return next;
      });
    },
    [ledgerBills],
  );

  function openDebtAccountFromBill(bill: Bill) {
    openDebtSection(bill.sourceDebtAccountId);
  }

  function handleSaveBill(input: BillInput, id?: string) {
    const normalizePaymentFields = (bill: Bill): Bill => {
      if (bill.status !== "Paid") {
        return {
          ...bill,
          paidDate: undefined,
          paidAmount: undefined,
          paymentMethod: undefined,
          paymentNote: undefined,
        };
      }

      return {
        ...bill,
        paidDate: bill.paidDate ?? getTodayDateString(),
      };
    };

    setBills((previous) => {
      if (id) {
        return previous.map((bill) =>
          bill.id === id
            ? normalizePaymentFields({
                ...bill,
                ...input,
              })
            : bill,
        );
      }

      return [
        normalizePaymentFields({ id: createBillId(), ...input }),
        ...previous,
      ];
    });

    setEditingBillId(null);
  }

  function handleDeleteBill(id: string) {
    const billToDelete = ledgerBills.find((bill) => bill.id === id);
    if (!billToDelete) {
      return;
    }

    if (billToDelete.sourceType === "debt-derived") {
      window.alert(
        "Debt-linked obligations are derived from Debt. Update the debt account in Debt, and keep Bills for payment capture only.",
      );
      openDebtAccountFromBill(billToDelete);
      return;
    }

    const shouldDelete = window.confirm(
      `Delete "${billToDelete.name}" from your bill list?`,
    );
    if (!shouldDelete) {
      return;
    }

    setBills((previous) => previous.filter((bill) => bill.id !== id));
    if (editingBillId === id) {
      setEditingBillId(null);
    }
  }

  function openPaymentDetailsModal(billIds: string[]) {
    if (billIds.length === 0) {
      return;
    }

    const existing =
      billIds.length === 1 ? ledgerBills.find((bill) => bill.id === billIds[0]) : undefined;
    setPaymentTargetBillIds(billIds);
    setPaymentDate(existing?.paidDate ?? getTodayDateString());
    setPaymentAmount(
      typeof existing?.paidAmount === "number" ? String(existing.paidAmount) : "",
    );
    setPaymentMethod(existing?.paymentMethod ?? "");
    setPaymentNote(existing?.paymentNote ?? "");
    setPaymentError("");
  }

  function closePaymentDetailsModal() {
    setPaymentTargetBillIds([]);
    setPaymentError("");
  }

  function handleAdvisorWalkthroughStart(anchorContext: AdvisorContext) {
    setWalkthroughReturnView(activeDashboardView);
    setActiveDashboardView(mapAdvisorContextToDashboardView(anchorContext));
  }

  function handleAdvisorWalkthroughEnd() {
    if (walkthroughReturnView) {
      setActiveDashboardView(walkthroughReturnView);
      setWalkthroughReturnView(null);
    }
  }

  function handleRecordPayment(billIds: string[]) {
    openPaymentDetailsModal(billIds);
  }

  function handleSavePaymentDetails() {
    if (paymentTargetBillIds.length === 0) {
      return;
    }

    if (!paymentDate) {
      setPaymentError("Date paid is required.");
      return;
    }

    const parsedAmount = Number.parseFloat(paymentAmount);
    const normalizedPaidAmount = normalizeAmount(parsedAmount);
    if (
      paymentAmount.trim().length > 0 &&
      (!Number.isFinite(normalizedPaidAmount) || normalizedPaidAmount <= 0)
    ) {
      setPaymentError("Amount paid must be greater than zero.");
      return;
    }

    setIsSavingPayment(true);
    upsertBillRecords(
      paymentTargetBillIds,
      (bill) => ({
        ...bill,
        status: "Paid",
        paidDate: paymentDate,
        paidAmount:
          paymentAmount.trim().length > 0 ? normalizedPaidAmount : undefined,
        paymentMethod:
          paymentMethod.trim().length > 0 ? paymentMethod.trim() : undefined,
        paymentNote:
          paymentNote.trim().length > 0 ? paymentNote.trim() : undefined,
      }),
      { allowDerivedCreation: true },
    );

    setIsSavingPayment(false);
    closePaymentDetailsModal();
  }

  function handleBulkStatusChange(billIds: string[], status: BillStatus) {
    const targetBills = ledgerBills.filter((bill) => billIds.includes(bill.id));
    const manualBillIds = targetBills
      .filter((bill) => bill.sourceType !== "debt-derived")
      .map((bill) => bill.id);

    if (manualBillIds.length === 0) {
      window.alert(
        "Debt-linked obligations keep their account structure in Debt. Use Mark Paid in Bills for operational payment capture.",
      );
      return;
    }

    upsertBillRecords(manualBillIds, (bill) =>
      status === "Paid"
        ? {
            ...bill,
            status,
            paidDate: bill.paidDate ?? getTodayDateString(),
          }
        : {
            ...bill,
            status,
            paidDate: undefined,
            paidAmount: undefined,
            paymentMethod: undefined,
            paymentNote: undefined,
          },
    );
  }

  function handleBulkCategoryChange(billIds: string[], category: BillCategory) {
    const targetBills = ledgerBills.filter((bill) => billIds.includes(bill.id));
    const manualBillIds = targetBills
      .filter((bill) => bill.sourceType !== "debt-derived")
      .map((bill) => bill.id);

    if (manualBillIds.length === 0) {
      window.alert(
        "Debt-linked obligations stay tied to their source debt account. Change account-level details in Debt instead of Bills.",
      );
      return;
    }

    upsertBillRecords(manualBillIds, (bill) => ({
      ...bill,
      category,
    }));
  }

  function handleBulkApplyLateFee(billIds: string[], lateFeeAmount: number) {
    upsertBillRecords(
      billIds,
      (bill) => ({
        ...bill,
        lateFeeAmount: normalizeAmount(lateFeeAmount),
      }),
      { allowDerivedCreation: true },
    );
  }

  function handleBulkRemoveLateFee(billIds: string[]) {
    upsertBillRecords(
      billIds,
      (bill) => ({
        ...bill,
        lateFeeAmount: undefined,
      }),
      { allowDerivedCreation: true },
    );
  }

  function handleBulkDelete(billIds: string[]) {
    if (billIds.length === 0) {
      return;
    }

    const targetBills = ledgerBills.filter((bill) => billIds.includes(bill.id));
    const manualBillIds = targetBills
      .filter((bill) => bill.sourceType !== "debt-derived")
      .map((bill) => bill.id);

    if (manualBillIds.length === 0) {
      window.alert(
        "Debt-linked obligations cannot be deleted from Bills. Remove or change the source debt account in Debt.",
      );
      return;
    }

    const shouldDelete = window.confirm(
      `Delete ${manualBillIds.length} selected manual bill${manualBillIds.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!shouldDelete) {
      return;
    }

    const billIdSet = new Set(manualBillIds);
    setBills((previous) => previous.filter((bill) => !billIdSet.has(bill.id)));
    if (editingBillId && billIdSet.has(editingBillId)) {
      setEditingBillId(null);
    }
  }

  function handleClearAll() {
    if (bills.length === 0) {
      return;
    }

    const shouldClear = window.confirm(
      debtAccounts.length > 0
        ? "Clear all manual bills and debt-linked operational history? Debt accounts themselves will remain in Debt."
        : "Delete all bills and reset this audit list? This cannot be undone.",
    );

    if (!shouldClear) {
      return;
    }

    setBills([]);
    setEditingBillId(null);
  }

  function handleClearViewFilters() {
    setStatusFilter("All");
    setCategoryFilter("All");
    setSearchQuery("");
    setCategoryDrilldownOrigin(null);
  }

  function handleCategoryDrillDown(
    category: BillCategory,
    sourceSectionId = "category-breakdown-section",
  ) {
    setCategoryDrilldownOrigin({
      view: activeDashboardView,
      sectionId: sourceSectionId,
    });
    setCategoryFilter(category);
    setActiveDashboardView("planning");
    window.setTimeout(() => {
      const tableSection = document.getElementById("bills-audit-section");
      if (tableSection) {
        tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 40);
  }

  function handleBackToCategoryBreakdown() {
    setCategoryFilter("All");
    const originView = categoryDrilldownOrigin?.view ?? "overview";
    const originSectionId =
      categoryDrilldownOrigin?.sectionId ?? "category-breakdown-section";
    setActiveDashboardView(originView);
    window.setTimeout(() => {
      const section = document.getElementById(originSectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  }

  function scrollToId(nextId: string) {
    window.setTimeout(() => {
      const section = document.getElementById(nextId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  }

  function openDebtSection(accountId?: string) {
    setFocusedDebtAccountId(accountId ?? null);
    setActiveDashboardView("debt");
    scrollToId("debt-section");
  }

  function handleSaveDebtAccount(account: DebtAccount) {
    setDebtAccounts((previous) => {
      const existing = previous.find((entry) => entry.id === account.id);
      if (!existing) {
        return [account, ...previous];
      }

      return previous.map((entry) => (entry.id === account.id ? account : entry));
    });
    setFocusedDebtAccountId(account.id);
  }

  function handleDeleteDebtAccount(accountId: string) {
    setDebtAccounts((previous) => previous.filter((account) => account.id !== accountId));
    setBills((previous) =>
      previous.filter((bill) => bill.sourceDebtAccountId !== accountId),
    );
    setFocusedDebtAccountId((previous) => (previous === accountId ? null : previous));
  }

  function getFutureIsoDate(daysFromNow: number): string {
    const next = new Date();
    next.setDate(next.getDate() + daysFromNow);
    return next.toISOString();
  }

  function upsertRecommendationWorkspaceState(
    source: AdvisorActionSource,
    overrides: Partial<NonNullable<AdvisorWorkspaceState["recommendationStates"]>[number]>,
  ) {
    if (source.kind !== "recommendation" || !source.recommendationType || !source.priority) {
      return;
    }

    const recommendationType = source.recommendationType;
    const priority = source.priority;

    persistAdvisorWorkspace((previous) => {
      const states = [...(previous?.recommendationStates ?? [])];
      const currentTimestamp = new Date().toISOString();
      const existingRecord = states.find((record) => record.recommendationId === source.id);
      const nextRecord: NonNullable<AdvisorWorkspaceState["recommendationStates"]>[number] = {
        recommendationId: source.id,
        title: source.label,
        context: advisorContext,
        recommendationType,
        state: "surfaced" as const,
        priority,
        focusBillId: source.focusBillId,
        focusCategory: source.focusCategory,
        whyNow: source.whyNow,
        surfacedAt: currentTimestamp,
        ...existingRecord,
        ...overrides,
        lastUpdatedAt: currentTimestamp,
      };

      const filtered = states.filter((record) => record.recommendationId !== source.id);
      return {
        ...previous,
        recommendationStates: [nextRecord, ...filtered].slice(0, 80),
      };
    });
  }

  function pinScenarioToWorkspace(source: AdvisorActionSource) {
    if (source.kind !== "scenario" || !source.scenarioType || !source.scenarioPriority) {
      return;
    }

    const scenarioType = source.scenarioType;
    const scenarioPriority = source.scenarioPriority;

    persistAdvisorWorkspace((previous) => {
      const currentTimestamp = new Date().toISOString();
      const scenarios = previous?.pinnedScenarios ?? [];
      const nextScenario = {
        scenarioId: source.id,
        title: source.label,
        context: advisorContext,
        priority: scenarioPriority,
        type: scenarioType,
        bestFor: source.scenarioBestFor,
        tradeoffSummary: source.scenarioTradeoffSummary,
        focusBillId: source.focusBillId,
        focusCategory: source.focusCategory,
        pinnedAt: currentTimestamp,
      };

      return {
        ...previous,
        pinnedScenarios: [
          nextScenario,
          ...scenarios.filter((scenario) => scenario.scenarioId !== source.id),
        ].slice(0, 40),
      };
    });
  }

  function addWorkspaceReminder(source: AdvisorActionSource, label: string, offsetDays: number) {
    persistAdvisorWorkspace((previous) => {
      const currentTimestamp = new Date().toISOString();
      const reminders = previous?.reminders ?? [];
      const nextReminder: NonNullable<AdvisorWorkspaceState["reminders"]>[number] = {
        id: createBillId(),
        type: "recheck-run",
        label,
        status: "scheduled",
        recommendationId: source.kind === "recommendation" ? source.id : undefined,
        scenarioId: source.kind === "scenario" ? source.id : undefined,
        focusBillId: source.focusBillId,
        focusCategory: source.focusCategory,
        scheduledFor: getFutureIsoDate(offsetDays),
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      };
      return {
        ...previous,
        reminders: [nextReminder, ...reminders].slice(0, 60),
      };
    });
  }

  function addWorkspaceWatch(source: AdvisorActionSource, kind: "bill" | "category" | "repeat-fee-risk") {
    persistAdvisorWorkspace((previous) => {
      const currentTimestamp = new Date().toISOString();
      const watches = previous?.watches ?? [];
      const label =
        kind === "bill"
          ? `Watch ${source.label}`
          : kind === "repeat-fee-risk"
            ? `Watch repeat fee risk${source.focusCategory ? ` in ${source.focusCategory}` : ""}`
            : `Watch ${source.focusCategory ?? source.label}`;
      const nextWatch: NonNullable<AdvisorWorkspaceState["watches"]>[number] = {
        id: createBillId(),
        kind,
        label,
        status: "active",
        focusBillId: source.focusBillId,
        focusCategory: source.focusCategory,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      };

      return {
        ...previous,
        watches: [nextWatch, ...watches].slice(0, 50),
      };
    });
  }

  async function handleAdvisorAnalysisRun() {
    setIsAdvisorRunning(true);
    setAdvisorError("");

    try {
      await ensureDashboardStatePersisted();

      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfRequestHeaders(),
        },
        body: JSON.stringify({
          context: advisorContext,
          reportingRange,
        }),
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to run advisor analysis.");
      }

      const payload = (await response.json()) as {
        preference: AdvisorPreference;
        response: AdvisorResponse;
      };

      setAdvisorPreference(payload.preference);
      setAdvisorResponse(payload.response);
      setAdvisorHubData((previous) =>
        previous
          ? {
              ...previous,
              latestAnalysis:
                payload.response.metadata.context === "all" || activeDashboardView === "advisor"
                  ? payload.response
                  : previous.latestAnalysis,
            }
          : previous,
      );
    } catch {
      setAdvisorError("Unable to run advisor analysis.");
    } finally {
      setIsAdvisorRunning(false);
    }
  }

  async function handleAdvisorPreferenceChange(nextPreference: AdvisorPreference) {
    setAdvisorPreference(nextPreference);

    try {
      const response = await fetch("/api/advisor", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfRequestHeaders(),
        },
        body: JSON.stringify(nextPreference),
      });

      if (!response.ok) {
        throw new Error("Failed to save advisor preference.");
      }

      const payload = (await response.json()) as { preference: AdvisorPreference };
      setAdvisorPreference(payload.preference);
      setAdvisorResponse((previous) =>
        previous
          ? {
              ...previous,
              metadata: {
                ...previous.metadata,
                cacheStatus: "stale",
                stale: true,
              },
            }
          : previous,
      );
      setAdvisorHubData((previous) =>
        previous
          ? {
              ...previous,
              latestAnalysis: previous.latestAnalysis
                ? {
                    ...previous.latestAnalysis,
                    metadata: {
                      ...previous.latestAnalysis.metadata,
                      cacheStatus: "stale",
                      stale: true,
                    },
                  }
                : previous.latestAnalysis,
            }
          : previous,
      );
    } catch {
      setAdvisorError("Unable to save advisor preference.");
    }
  }

  function recordAdvisorAction(action: AdvisorAction, source?: AdvisorActionSource) {
    if (!source || !advisorResponse) {
      return;
    }

    void fetch("/api/advisor/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getCsrfRequestHeaders(),
      },
      body: JSON.stringify({
        context: advisorContext,
        reportingRange,
        sourceKind: source.kind,
        sourceId: source.id,
        sourceLabel: source.label,
        actionType:
          source.kind === "scenario" ? "follow-scenario" : "follow-recommendation",
        runId: advisorResponse.metadata.runId,
        action,
        dataQualityLevel: advisorResponse.trust.dataQuality.level,
        shownRecommendationIds: advisorResponse.rankedItems.map((item) => item.id),
        shownRecommendationTypes: advisorResponse.rankedItems.map(
          (item) => item.recommendationType,
        ),
        shownFocusBillIds: advisorResponse.rankedItems
          .map((item) => item.focusBillId)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
        shownFocusCategories: advisorResponse.rankedItems
          .map((item) => item.focusCategory)
          .filter(
            (value): value is BillCategory =>
              typeof value === "string" && value.length > 0,
          ),
        shownScenarioTypes: advisorResponse.scenarios.map((scenario) => scenario.type),
      }),
    });
  }

  function handleAdvisorAction(action: AdvisorAction, source?: AdvisorActionSource) {
    recordAdvisorAction(action, source);

    if (source?.kind === "recommendation") {
      if (
        action.type === "goToOverview" ||
        action.type === "goToBills" ||
        action.type === "goToReporting" ||
        action.type === "filterPastDue" ||
        action.type === "filterDueSoon" ||
        action.type === "filterCategory" ||
        action.type === "searchBill"
      ) {
        upsertRecommendationWorkspaceState(source, { state: "acted-on" });
      }

      if (action.type === "markDone") {
        upsertRecommendationWorkspaceState(source, { state: "resolved", resolvedAt: new Date().toISOString() });
      }

      if (action.type === "snooze") {
        upsertRecommendationWorkspaceState(source, {
          state: "snoozed",
          snoozedUntil: getFutureIsoDate(3),
        });
      }

      if (action.type === "notPossibleThisWeek") {
        upsertRecommendationWorkspaceState(source, {
          state: "not-possible-this-week",
          snoozedUntil: getFutureIsoDate(7),
        });
      }

      if (action.type === "remindLater") {
        upsertRecommendationWorkspaceState(source, {
          state: "saved",
          reminderType: action.reminderType ?? "recheck-run",
          reminderAt: getFutureIsoDate(3),
        });
        addWorkspaceReminder(source, `Revisit ${source.label}`, 3);
      }

      if (action.type === "pinToHub") {
        upsertRecommendationWorkspaceState(source, { state: "saved", pinnedToHub: true });
      }

      if (action.type === "watchBill") {
        addWorkspaceWatch(source, "bill");
      }

      if (action.type === "watchCategory") {
        addWorkspaceWatch(source, "category");
      }

      if (action.type === "watchRepeatFeeRisk") {
        addWorkspaceWatch(source, "repeat-fee-risk");
      }
    }

    if (source?.kind === "scenario") {
      if (action.type === "pinToHub") {
        pinScenarioToWorkspace(source);
      }

      if (action.type === "remindLater") {
        addWorkspaceReminder(source, `Revisit scenario: ${source.label}`, 3);
      }
    }

    if (action.type === "goToOverview") {
      setActiveDashboardView("overview");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (action.type === "goToReporting") {
      setActiveDashboardView("reporting");
      scrollToId("reporting-section");
      return;
    }

    if (action.type === "goToBills") {
      setActiveDashboardView("planning");
      scrollToId("bills-audit-section");
      return;
    }

    if (action.type === "filterPastDue") {
      setActiveDashboardView("planning");
      setStatusFilter("Past Due");
      setCategoryFilter("All");
      setSortBy("dueDate");
      setSortDirection("asc");
      setSearchQuery("");
      scrollToId("bills-audit-section");
      return;
    }

    if (action.type === "filterDueSoon") {
      setActiveDashboardView("planning");
      setStatusFilter("Upcoming");
      setCategoryFilter("All");
      setSortBy("dueDate");
      setSortDirection("asc");
      setSearchQuery("");
      scrollToId("bills-audit-section");
      return;
    }

    if (action.type === "filterCategory") {
      setActiveDashboardView("planning");
      setStatusFilter("All");
      setCategoryFilter(action.category);
      setSortBy("dueDate");
      setSortDirection("asc");
      setSearchQuery("");
      scrollToId("bills-audit-section");
      return;
    }

    if (action.type === "searchBill") {
      setActiveDashboardView("planning");
      setStatusFilter("All");
      setCategoryFilter("All");
      setSortBy("dueDate");
      setSortDirection("asc");
      setSearchQuery(action.query);
      scrollToId("bills-audit-section");
    }
  }

  function handleExportJson(billsToExport: Bill[], mode: "all" | "view") {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportMode: mode,
      startingBalance,
      includePaidInTotals,
      bills: billsToExport,
    };

    downloadFile(
      mode === "all" ? "bill-audit-export-all.json" : "bill-audit-export-view.json",
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  }

  function handleExportCsv(billsToExport: Bill[], mode: "all" | "view") {
    downloadFile(
      mode === "all" ? "bill-audit-export-all.csv" : "bill-audit-export-view.csv",
      buildCsv(billsToExport),
      "text/csv",
    );
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        ...getCsrfRequestHeaders(),
      },
    });
    window.location.href = "/login";
  }

  function openAccountModal() {
    setAccountFormName(accountDisplayName);
    setAccountFormEmail(accountEmail);
    setAccountFormAvatarEnabled(accountAvatarEnabled);
    setAccountFormAvatarSeed(accountAvatarSeed);
    setAccountCurrentPassword("");
    setAccountNewPassword("");
    setAccountError("");
    setAccountSuccess("");
    setIsAccountModalOpen(true);
  }

  async function handleSaveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountError("");
    setAccountSuccess("");
    setIsSavingAccount(true);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfRequestHeaders(),
        },
        body: JSON.stringify({
          displayName: accountFormName,
          email: accountFormEmail,
          avatarEnabled: accountFormAvatarEnabled,
          avatarSeed: accountFormAvatarSeed,
          currentPassword: accountCurrentPassword,
          newPassword: accountNewPassword,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
        displayName?: string;
        avatarEnabled?: boolean;
        avatarSeed?: string;
      };

      if (!response.ok) {
        setAccountError(body.error ?? "Unable to update account.");
        return;
      }

      setAccountEmail(body.email ?? accountFormEmail);
      setAccountDisplayName(body.displayName ?? accountFormName);
      setAccountAvatarEnabled(body.avatarEnabled ?? accountFormAvatarEnabled);
      setAccountAvatarSeed(body.avatarSeed ?? accountFormAvatarSeed);
      setAccountCurrentPassword("");
      setAccountNewPassword("");
      setAccountSuccess("Account updated.");
    } catch {
      setAccountError("Unable to update account.");
    } finally {
      setIsSavingAccount(false);
    }
  }

  const welcomeName = accountDisplayName.trim()
    ? accountDisplayName.trim()
    : accountEmail.includes("@")
      ? accountEmail.split("@")[0] ?? "User"
      : "User";
  const showOverviewSection =
    activeDashboardView === "overview" || activeDashboardView === "all";
  const showAdvisorHubSection = activeDashboardView === "advisor";
  const showBillsSection =
    activeDashboardView === "planning" ||
    activeDashboardView === "audit" ||
    activeDashboardView === "all";
  const showDebtSection =
    activeDashboardView === "debt" || activeDashboardView === "all";
  const showReportingSection =
    activeDashboardView === "reporting" || activeDashboardView === "all";

  if (!isHydrated) {
    return (
      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 py-6 sm:px-6 lg:gap-7 lg:px-10 lg:py-10">
        <section className="dashboard-shell rounded-3xl p-8">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <Layers className="h-3.5 w-3.5 text-blue-700" />
            Loading
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            Restoring your saved finance dashboard...
          </p>
          <p className="mt-1 text-sm text-slate-600">
            We only render balances after local data is loaded to avoid showing
            misleading defaults.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-4 py-6 sm:px-6 lg:gap-8 lg:px-10 lg:py-10">
      {showWelcomeSplash ? (
        <div
          className={`fixed inset-0 z-[120] flex items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(29,78,216,0.22),transparent_36%),linear-gradient(180deg,#eff5ff_0%,#e6eefb_100%)] backdrop-blur-sm transition-opacity duration-300 ${
            welcomeExiting ? "opacity-0" : "opacity-100"
          }`}
          aria-live="polite"
        >
          <div className="dashboard-shell w-[min(92vw,540px)] rounded-3xl p-6 text-center sm:p-8">
            <div className="mb-3 flex justify-center">
              <UserAvatar
                accountId={accountId}
                name={accountDisplayName}
                email={accountEmail}
                avatarEnabled={accountAvatarEnabled}
                avatarSeed={accountAvatarSeed}
                size="lg"
              />
            </div>
            <p className="dashboard-chip mx-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]">
              <Layers className="h-3.5 w-3.5" />
              Welcome Back
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
              Loading Your Finance Dashboard
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Syncing your secure data from cloud storage.
            </p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/2 animate-[welcomeSweep_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={openAccountModal}
          className="dashboard-control dashboard-hover-lift inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-indigo-500"
        >
          <UserAvatar
            accountId={accountId}
            name={accountDisplayName}
            email={accountEmail}
            avatarEnabled={accountAvatarEnabled}
            avatarSeed={accountAvatarSeed}
            size="sm"
          />
          Welcome, {welcomeName}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="dashboard-control dashboard-hover-lift inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {loadError}
        </p>
      ) : null}

      <section className="dashboard-shell dashboard-shell-strip dashboard-animate-in rounded-2xl p-3.5">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {DASHBOARD_VIEWS.map((view) => {
            const Icon = view.icon;
            const isActive = activeDashboardView === view.id;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveDashboardView(view.id)}
                className={`dashboard-control dashboard-hover-lift rounded-xl border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-blue-700 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_12px_24px_-16px_rgba(37,99,235,0.75)]"
                    : "border-slate-200 bg-white/90 hover:bg-slate-50"
                }`}
                aria-pressed={isActive}
              >
                <span
                  className={`inline-flex items-center gap-2 text-sm font-semibold ${
                    isActive ? "text-white" : "text-slate-900"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? "text-blue-100" : "text-slate-500"}`}
                  />
                  {view.label}
                </span>
                <span
                  className={`mt-1 block text-xs ${
                    isActive ? "text-blue-100/90" : "text-slate-600"
                  }`}
                >
                  {view.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeDashboardView !== "advisor" ? (
        <AdvisorPanel
          context={advisorContext}
          walkthroughAnchorContext="overview"
          response={advisorResponse}
          preference={advisorPreference}
          workspace={advisorWorkspace}
          isLoading={isAdvisorLoading}
          isRunning={isAdvisorRunning}
          error={advisorError}
          onAction={handleAdvisorAction}
          onPreferenceChange={handleAdvisorPreferenceChange}
          onRunAnalysis={handleAdvisorAnalysisRun}
          onWalkthroughStart={handleAdvisorWalkthroughStart}
          onWalkthroughEnd={handleAdvisorWalkthroughEnd}
          onOpenHub={() => {
            setActiveDashboardView("advisor");
          }}
        />
      ) : null}

      {showAdvisorHubSection ? (
        <AdvisorHubSection
          hub={advisorHubData}
          preference={advisorPreference}
          isLoading={isAdvisorLoading}
          isRunning={isAdvisorRunning}
          onRunAnalysis={handleAdvisorAnalysisRun}
        />
      ) : null}

      {showOverviewSection ? (
        <section className="space-y-5 dashboard-animate-in" style={{ "--dashboard-delay": "60ms" } as CSSProperties}>
          <BalanceHeader
            startingBalance={startingBalance}
            onStartingBalanceChange={(next) =>
              setStartingBalance(normalizeAmount(next))
            }
            includePaidInTotals={includePaidInTotals}
            onIncludePaidInTotalsChange={setIncludePaidInTotals}
            balanceLeft={summary.balanceLeft}
            negativeAmount={summary.negativeAmount}
          />

          <SummaryCards
            startingBalance={startingBalance}
            totalBills={summary.totalBills}
            numberOfBills={summary.numberOfBills}
            balanceLeft={summary.balanceLeft}
            negativeAmount={summary.negativeAmount}
            activeBillCount={summary.activeBillCount}
            pastDueCount={summary.pastDueCount}
            paidTotal={summary.paidTotal}
            unpaidTotal={summary.unpaidTotal}
            dueIn7DaysCount={summary.dueIn7DaysCount}
            dueIn7DaysTotal={summary.dueIn7DaysTotal}
            dueThisMonthTotal={summary.dueThisMonthTotal}
            nextBillDueDate={summary.nextBillDueDate}
            nextBillDueAmount={summary.nextBillDueAmount}
            totalLateFees={summary.totalLateFees}
            billsWithLateFees={summary.billsWithLateFees}
            lateFeePercentOfTotal={summary.lateFeePercentOfTotal}
            highestLateFee={summary.highestLateFee}
            categoryBreakdown={summary.categoryBreakdown}
            includePaidInTotals={includePaidInTotals}
            activeCategoryFilter={categoryFilter}
            dueSoonExpanded={uiSectionVisibility.dueSoon}
            lateFeeExpanded={uiSectionVisibility.lateFees}
            categoryChartExpanded={uiSectionVisibility.categoryChart}
            onDueSoonExpandedChange={(next) =>
              setUiSectionVisibility((previous) => ({
                ...previous,
                dueSoon: next,
              }))
            }
            onLateFeeExpandedChange={(next) =>
              setUiSectionVisibility((previous) => ({
                ...previous,
                lateFees: next,
              }))
            }
            onCategoryChartExpandedChange={(next) =>
              setUiSectionVisibility((previous) => ({
                ...previous,
                categoryChart: next,
              }))
            }
            onCategorySelect={handleCategoryDrillDown}
            onClearCategoryFilter={() => setCategoryFilter("All")}
            onBackToCategoryBreakdown={handleBackToCategoryBreakdown}
          />

          {debtOverviewSnapshot.activeAccountCount > 0 ? (
            <DebtOverviewSnapshotSection
              snapshot={debtOverviewSnapshot}
              onOpenDebt={() => openDebtSection()}
              onOpenAccountsBehind={() => openDebtSection()}
              onOpenNextDebtPayment={(accountId) => openDebtSection(accountId)}
              onOpenDebtCash={() => openDebtSection()}
              onOpenNeedsReview={() => openDebtSection()}
            />
          ) : null}

          <SmartInsightsSection
            insights={smartInsightsCompact}
            isExpanded={uiSectionVisibility.insights}
            onExpandedChange={(next) =>
              setUiSectionVisibility((previous) => ({
                ...previous,
                insights: next,
              }))
            }
          />

          <UpcomingBillsSection
            bills={upcomingBills}
            isExpanded={uiSectionVisibility.upcoming}
            onExpandedChange={(next) =>
              setUiSectionVisibility((previous) => ({
                ...previous,
                upcoming: next,
              }))
            }
          />
        </section>
      ) : null}

      {showBillsSection ? (
        <section className="space-y-4 dashboard-animate-in" style={{ "--dashboard-delay": "80ms" } as CSSProperties}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bills</h2>
              <p className="mt-1 text-sm text-slate-600">
                Add bills fast, then work directly in the table.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBillFormExpanded((previous) => !previous)}
              className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              aria-expanded={isBillFormExpanded}
              aria-controls="bill-entry-panel"
            >
              {isBillFormExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Add Bill
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show Add Bill
                </>
              )}
            </button>
          </div>

          {isBillFormExpanded ? (
            <div id="bill-entry-panel">
              <BillForm
                key={editingBill?.id ?? "new"}
                editingBill={editingBill}
                onSaveBill={handleSaveBill}
                onCancelEdit={() => setEditingBillId(null)}
              />
            </div>
          ) : null}
          <BillsTable
            bills={visibleBills}
            runningBalances={runningBalances}
            includePaidInTotals={includePaidInTotals}
            statusFilter={statusFilter}
            categoryFilter={categoryFilter}
            hasActiveFilters={hasActiveFilters}
            balanceLeft={summary.balanceLeft}
            sortBy={sortBy}
            sortDirection={sortDirection}
            totalBillCount={ledgerBills.length}
            visibleBillCount={visibleBills.length}
            searchQuery={searchQuery}
            onStatusFilterChange={setStatusFilter}
            onCategoryFilterChange={setCategoryFilter}
            onSearchQueryChange={setSearchQuery}
            onSortByChange={setSortBy}
            onSortDirectionChange={setSortDirection}
            onClearViewFilters={handleClearViewFilters}
            onBackToCategoryBreakdown={handleBackToCategoryBreakdown}
            onExportAllJson={() => handleExportJson(ledgerBills, "all")}
            onExportAllCsv={() => handleExportCsv(ledgerBills, "all")}
            onExportViewCsv={() => handleExportCsv(visibleBills, "view")}
            onClearAll={handleClearAll}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkCategoryChange={handleBulkCategoryChange}
            onBulkApplyLateFee={handleBulkApplyLateFee}
            onBulkRemoveLateFee={handleBulkRemoveLateFee}
            onBulkRecordPayment={handleRecordPayment}
            onBulkDelete={handleBulkDelete}
            debtAccountsById={debtAccountsById}
            onEdit={(bill) => {
              if (bill.sourceType === "debt-derived") {
                openDebtAccountFromBill(bill);
                return;
              }
              setEditingBillId(bill.id);
            }}
            onDelete={handleDeleteBill}
            onRecordPayment={handleRecordPayment}
          />
        </section>
      ) : null}

      {showDebtSection ? (
        <section
          className="space-y-4 dashboard-animate-in"
          style={{ "--dashboard-delay": "85ms" } as CSSProperties}
        >
          <DebtSection
            accounts={debtAccounts}
            bills={ledgerBills}
            summary={debtSummary}
            downstreamSnapshot={debtDownstreamSnapshot}
            focusedAccountId={focusedDebtAccountId ?? undefined}
            onSaveAccount={handleSaveDebtAccount}
            onDeleteAccount={handleDeleteDebtAccount}
          />
        </section>
      ) : null}

      {showReportingSection ? (
        <section
          id="reporting-section"
          className="space-y-4 dashboard-animate-in"
          style={{ "--dashboard-delay": "90ms" } as CSSProperties}
        >
          <ReportingSection
            snapshot={reportingSnapshot}
            debtSnapshot={debtReportingSnapshot}
            selectedRange={reportingRange}
            activeCategoryFilter={categoryFilter}
            onRangeChange={setReportingRange}
            onCategoryDrillDown={handleCategoryDrillDown}
            onClearCategoryFilter={() => setCategoryFilter("All")}
            onBackToCategoryBreakdown={handleBackToCategoryBreakdown}
            onOpenDebt={() => openDebtSection()}
          />
        </section>
      ) : null}

      <PaymentDetailsModal
        isOpen={paymentTargetBillIds.length > 0}
        targetCount={paymentTargetBillIds.length}
        paidDate={paymentDate}
        paidAmount={paymentAmount}
        paymentMethod={paymentMethod}
        paymentNote={paymentNote}
        error={paymentError}
        isSaving={isSavingPayment}
        onPaidDateChange={setPaymentDate}
        onPaidAmountChange={setPaymentAmount}
        onPaymentMethodChange={setPaymentMethod}
        onPaymentNoteChange={setPaymentNote}
        onClose={closePaymentDetailsModal}
        onConfirm={handleSavePaymentDetails}
      />

      {isAccountModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/45 p-4">
          <section className="dashboard-shell w-[min(96vw,620px)] max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Account Settings</h2>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="dashboard-close-button dashboard-close-button-md"
                aria-label="Close account settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleSaveAccount}>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                  User Name
                </span>
                <input
                  type="text"
                  value={accountFormName}
                  onChange={(event) => setAccountFormName(event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  placeholder="Display name"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                  Email Address
                </span>
                <input
                  type="email"
                  value={accountFormEmail}
                  onChange={(event) => setAccountFormEmail(event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                  Current Password
                </span>
                <input
                  type="password"
                  value={accountCurrentPassword}
                  onChange={(event) => setAccountCurrentPassword(event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  placeholder="Required for email/password changes"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                  New Password
                </span>
                <input
                  type="password"
                  value={accountNewPassword}
                  onChange={(event) => setAccountNewPassword(event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  placeholder="Leave blank to keep current password"
                />
              </label>

              <section className="dashboard-shell-inner rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold text-slate-900">Avatar</p>
                </div>
                <p className="mb-3 text-xs text-slate-600">
                  Use a Beam avatar or show initials only.
                </p>

                <div className="mb-3 flex items-center gap-3">
                  <UserAvatar
                    accountId={accountId}
                    name={accountFormName}
                    email={accountFormEmail}
                    avatarEnabled={accountFormAvatarEnabled}
                    avatarSeed={accountFormAvatarSeed}
                    size="md"
                  />
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={accountFormAvatarEnabled}
                      onChange={(event) =>
                        setAccountFormAvatarEnabled(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-700"
                    />
                    Use Beam avatar
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountFormAvatarSeed(createAvatarSeed())}
                    className="dashboard-control inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountFormAvatarEnabled(false);
                      setAccountFormAvatarSeed("");
                    }}
                    className="dashboard-control inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Reset to Default
                  </button>
                </div>
              </section>

              {accountError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {accountError}
                </p>
              ) : null}
              {accountSuccess ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {accountSuccess}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="dashboard-control inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-4 text-sm font-semibold text-white transition hover:from-blue-800 hover:to-indigo-800 disabled:opacity-60"
                >
                  {isSavingAccount ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>

            <MfaSettings email={accountEmail || accountFormEmail} />
          </section>
        </div>
      ) : null}
    </main>
  );
}
