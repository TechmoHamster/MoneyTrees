import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAdvisorAnalysis } from "@/lib/advisor";
import {
  ADVISOR_FACTS_VERSION,
  ADVISOR_PROVIDER_NAME,
  ADVISOR_PROVIDER_VERSION,
  type AdvisorResponse,
  type AdvisorRunRecord,
} from "@/lib/advisor-contracts";
import {
  buildAdvisorFacts,
  getAdvisorHubForUser,
  getAdvisorSnapshotForUser,
  hashAdvisorFacts,
  recordAdvisorActionForUser,
  runAdvisorAnalysisForUser,
  saveAdvisorPreferenceForUser,
} from "@/lib/advisor-service";
import type {
  AdvisorPreference,
  Bill,
  DebtAccount,
  DashboardState,
  ReportingRange,
} from "@/lib/types";
import type {
  AdvisorActionWriteInput,
  AdvisorRepository,
} from "@/lib/advisor-persistence";
import { calculateSummary } from "@/lib/utils";

function getOffsetDateString(offsetDays: number): string {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  target.setDate(target.getDate() + offsetDays);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createBill(overrides: Partial<Bill>): Bill {
  return {
    id: "bill-1",
    name: "Bill",
    category: "Utilities",
    status: "Upcoming",
    dueDate: getOffsetDateString(5),
    amount: 10,
    ...overrides,
  };
}

function createDashboardState(overrides?: Partial<DashboardState>): DashboardState {
  return {
    startingBalance: 1200,
    includePaidInTotals: false,
    bills: [
      createBill({
        id: "rent",
        name: "Rent",
        category: "Rent / Housing",
        amount: 850,
        dueDate: getOffsetDateString(2),
      }),
      createBill({
        id: "power",
        name: "Power",
        category: "Utilities",
        amount: 145,
        dueDate: getOffsetDateString(5),
      }),
    ],
    ...overrides,
  };
}

function createDebtAccount(overrides?: Partial<DebtAccount>): DebtAccount {
  return {
    id: "debt-1",
    providerName: "Debt Account",
    debtType: "Installment Loan",
    currentBalance: 1500,
    paymentCadence: "Monthly",
    nextDueDate: getOffsetDateString(6),
    minimumPayment: 125,
    scheduledPaymentAmount: 150,
    lifecycleState: "Active",
    paymentRequirement: "Payment Required",
    interestAccrual: "No Interest Accruing",
    ...overrides,
  };
}

function createPreference(overrides?: Partial<AdvisorPreference>): AdvisorPreference {
  return {
    strategy: "reduce-overdue-count",
    minimumCashBuffer: 200,
    ...overrides,
  };
}

function createSummarySnapshot(state: DashboardState) {
  const summary = calculateSummary(
    state.bills,
    state.startingBalance,
    state.includePaidInTotals,
  );

  return {
    balanceLeft: summary.balanceLeft,
    negativeAmount: summary.negativeAmount,
    pastDueCount: summary.pastDueCount,
    unpaidTotal: summary.unpaidTotal,
    totalLateFees: summary.totalLateFees,
    dueIn7DaysCount: summary.dueIn7DaysCount,
    dueIn7DaysTotal: summary.dueIn7DaysTotal,
  };
}

function createResponse(
  state: DashboardState,
  preference: AdvisorPreference,
  context: "overview" | "planning" | "reporting" | "all" = "all",
  reportingRange: ReportingRange = "month",
): AdvisorResponse {
  const facts = buildAdvisorFacts({
    userId: "user-1",
    context,
    reportingRange,
    dashboardState: state,
    dashboardUpdatedAt: "2026-04-05T00:00:00.000Z",
    preference,
    tracking: [],
  });
  const output = buildAdvisorAnalysis(facts);

  return {
    ...output,
    metadata: {
      context,
      reportingRange,
      strategy: preference.strategy,
      minimumCashBuffer: preference.minimumCashBuffer,
      provider: ADVISOR_PROVIDER_NAME,
      providerVersion: ADVISOR_PROVIDER_VERSION,
      factsVersion: ADVISOR_FACTS_VERSION,
      cacheStatus: "fresh",
      stale: false,
      analyzedAt: "2026-04-05T00:00:00.000Z",
    },
  };
}

function createRunRecord(
  state: DashboardState,
  preference: AdvisorPreference,
  options?: {
    id?: string;
    context?: "overview" | "planning" | "reporting" | "all";
    reportingRange?: ReportingRange;
    factsHash?: string;
  },
): AdvisorRunRecord {
  const context = options?.context ?? "all";
  const reportingRange = options?.reportingRange ?? "month";
  const facts = buildAdvisorFacts({
    userId: "user-1",
    context,
    reportingRange,
    dashboardState: state,
    dashboardUpdatedAt: "2026-04-05T00:00:00.000Z",
    preference,
    tracking: [],
  });

  return {
    id: options?.id ?? "run-1",
    userId: "user-1",
    context,
    reportingRange,
    strategy: preference.strategy,
    minimumCashBuffer: preference.minimumCashBuffer,
    provider: ADVISOR_PROVIDER_NAME,
    providerVersion: ADVISOR_PROVIDER_VERSION,
    factsVersion: ADVISOR_FACTS_VERSION,
    factsHash: options?.factsHash ?? hashAdvisorFacts(facts),
    response: createResponse(state, preference, context, reportingRange),
    summarySnapshot: createSummarySnapshot(state),
    dataQualityLevel: createResponse(state, preference, context, reportingRange).trust.dataQuality.level,
    createdAt: "2026-04-05T00:00:00.000Z",
  };
}

function createRepository(
  state: DashboardState,
  preference: AdvisorPreference | null = createPreference(),
): AdvisorRepository & {
  saveAdvisorRun: ReturnType<typeof vi.fn>;
  saveAdvisorPreference: ReturnType<typeof vi.fn>;
  saveAdvisorAction: ReturnType<typeof vi.fn>;
  loadLatestAdvisorRun: ReturnType<typeof vi.fn>;
  loadMatchingAdvisorRun: ReturnType<typeof vi.fn>;
} {
  return {
    loadDashboardState: vi.fn().mockResolvedValue({
      state,
      updatedAt: "2026-04-05T00:00:00.000Z",
    }),
    loadAdvisorPreference: vi.fn().mockResolvedValue(preference),
    saveAdvisorPreference: vi
      .fn()
      .mockImplementation(async (_userId: string, nextPreference: AdvisorPreference) => nextPreference),
    loadLatestAdvisorRun: vi.fn().mockResolvedValue(null),
    listAdvisorRuns: vi.fn().mockResolvedValue([]),
    loadMatchingAdvisorRun: vi.fn().mockResolvedValue(null),
    saveAdvisorRun: vi.fn().mockImplementation(async (input) => ({
      id: "saved-run",
      createdAt: "2026-04-05T00:05:00.000Z",
      ...input,
    })),
    listRecentTrackingEvents: vi.fn().mockResolvedValue([]),
    saveAdvisorAction: vi
      .fn()
      .mockImplementation(async (input: AdvisorActionWriteInput) => ({
        id: "action-1",
        createdAt: "2026-04-05T00:06:00.000Z",
        ...input,
      })),
  };
}

describe("advisor-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds stable advisor facts from dashboard state", () => {
    const state = createDashboardState({
      bills: [
        createBill({
          id: "late",
          name: "Late Bill",
          status: "Past Due",
          lateFeeAmount: 25,
          dueDate: getOffsetDateString(-2),
          amount: 180,
        }),
      ],
    });
    const preference = createPreference({ strategy: "minimize-late-fees" });

    const facts = buildAdvisorFacts({
      userId: "user-1",
      context: "planning",
      reportingRange: "month",
      dashboardState: state,
      dashboardUpdatedAt: "2026-04-05T00:00:00.000Z",
      preference,
      tracking: [],
    });

    expect(facts.version).toBe(ADVISOR_FACTS_VERSION);
    expect(facts.context).toBe("planning");
    expect(facts.preference.strategy).toBe("minimize-late-fees");
    expect(facts.summary.pastDueCount).toBe(1);
    expect(facts.summary.totalLateFees).toBe(25);
    expect(facts.reporting.range).toBe("month");
    expect(facts.source.kind).toBe("supabase");
    expect(facts.source.userId).toBe("user-1");
  });

  it("includes the debt downstream snapshot in advisor facts for shared consumers", () => {
    const state = createDashboardState({
      bills: [],
      debtAccounts: [
        createDebtAccount({
          id: "debt-1",
          providerName: "Debt One",
          debtType: "Installment Loan",
          currentBalance: 1000,
          minimumPayment: 100,
          scheduledPaymentAmount: 150,
        }),
      ],
    });
    const preference = createPreference();

    const facts = buildAdvisorFacts({
      userId: "user-1",
      context: "overview",
      reportingRange: "month",
      dashboardState: state,
      dashboardUpdatedAt: "2026-04-05T00:00:00.000Z",
      preference,
      tracking: [],
    });

    expect(facts.source.debtSnapshot.summary.totalDebtBalance).toBe(1000);
    expect(facts.source.debtSnapshot.accountFacts).toHaveLength(1);
    expect(facts.source.debtSnapshot.accountFacts[0]).toMatchObject({
      accountId: "debt-1",
      providerName: "Debt One",
      linkedSchedule: expect.objectContaining({
        editableInBills: false,
        owner: "Debt",
      }),
    });
  });

  it("returns a cached snapshot when the latest run matches the current facts hash", async () => {
    const state = createDashboardState();
    const preference = createPreference();
    const repository = createRepository(state, preference);
    const run = createRunRecord(state, preference);
    repository.loadLatestAdvisorRun.mockResolvedValue(run);

    const result = await getAdvisorSnapshotForUser(
      {
        userId: "user-1",
        context: "planning",
        reportingRange: "month",
      },
      repository,
    );

    expect(result.response?.metadata.cacheStatus).toBe("cached");
    expect(result.response?.metadata.stale).toBe(false);
    expect(result.response?.metadata.runId).toBe("run-1");
    expect(repository.loadLatestAdvisorRun).toHaveBeenCalledTimes(1);
  });

  it("re-scopes the same saved backbone run across sections without requiring a rerun", async () => {
    const state = createDashboardState();
    const preference = createPreference();
    const repository = createRepository(state, preference);
    const run = createRunRecord(state, preference, {
      id: "backbone-run",
      context: "all",
      reportingRange: "month",
    });
    repository.listAdvisorRuns.mockResolvedValue([run]);

    const overview = await getAdvisorSnapshotForUser(
      {
        userId: "user-1",
        context: "overview",
        reportingRange: "month",
      },
      repository,
    );
    const planning = await getAdvisorSnapshotForUser(
      {
        userId: "user-1",
        context: "planning",
        reportingRange: "month",
      },
      repository,
    );
    const reporting = await getAdvisorSnapshotForUser(
      {
        userId: "user-1",
        context: "reporting",
        reportingRange: "month",
      },
      repository,
    );

    expect(overview.response?.metadata.runId).toBe("backbone-run");
    expect(overview.response?.metadata.cacheStatus).toBe("cached");
    expect(overview.response?.metadata.context).toBe("overview");
    expect(overview.response?.metadata.derivedFromContext).toBe("all");
    expect(overview.response?.metadata.analyzedAt).toBe(run.createdAt);

    expect(planning.response?.metadata.runId).toBe("backbone-run");
    expect(planning.response?.metadata.cacheStatus).toBe("cached");
    expect(planning.response?.metadata.context).toBe("planning");
    expect(planning.response?.metadata.derivedFromContext).toBe("all");
    expect(planning.response?.metadata.analyzedAt).toBe(run.createdAt);

    expect(reporting.response?.metadata.runId).toBe("backbone-run");
    expect(reporting.response?.metadata.cacheStatus).toBe("cached");
    expect(reporting.response?.metadata.context).toBe("reporting");
    expect(reporting.response?.metadata.derivedFromContext).toBe("all");
    expect(reporting.response?.metadata.analyzedAt).toBe(run.createdAt);
  });

  it("returns a stale snapshot when persisted analysis no longer matches current facts", async () => {
    const state = createDashboardState();
    const preference = createPreference();
    const repository = createRepository(state, preference);
    const run = createRunRecord(state, preference, {
      factsHash: "outdated-hash",
    });
    repository.loadLatestAdvisorRun.mockResolvedValue(run);

    const result = await getAdvisorSnapshotForUser(
      {
        userId: "user-1",
        context: "planning",
        reportingRange: "month",
      },
      repository,
    );

    expect(result.response?.metadata.cacheStatus).toBe("stale");
    expect(result.response?.metadata.stale).toBe(true);
  });

  it("returns advisor hub history for the all-system context", async () => {
    const state = createDashboardState();
    const preference = createPreference({ strategy: "minimize-late-fees" });
    const repository = createRepository(state, preference);
    const latestRun = createRunRecord(state, preference, {
      id: "run-latest",
      context: "all",
    });
    const previousRun = createRunRecord(state, preference, {
      id: "run-previous",
      context: "all",
    });

    repository.loadLatestAdvisorRun.mockResolvedValue(latestRun);
    repository.listAdvisorRuns.mockResolvedValue([latestRun, previousRun]);

    const result = await getAdvisorHubForUser(
      {
        userId: "user-1",
        context: "planning",
        reportingRange: "month",
      },
      repository,
    );

    expect(result.hub.latestAnalysis?.metadata.runId).toBe("run-latest");
    expect(result.hub.history).toHaveLength(2);
    expect(result.hub.history[0]?.headline).toBe(latestRun.response.summary.headline);
    expect(repository.listAdvisorRuns).toHaveBeenCalledWith("user-1", {
      context: "all",
      reportingRange: "month",
      limit: 12,
    });
  });

  it("reuses a matching persisted run instead of recomputing when force is not set", async () => {
    const state = createDashboardState();
    const preference = createPreference();
    const repository = createRepository(state, preference);
    const run = createRunRecord(state, preference);
    repository.loadMatchingAdvisorRun.mockResolvedValue(run);

    const result = await runAdvisorAnalysisForUser(
      {
        userId: "user-1",
        context: "planning",
        reportingRange: "month",
      },
      repository,
    );

    expect(result.response.metadata.cacheStatus).toBe("cached");
    expect(repository.loadMatchingAdvisorRun).toHaveBeenCalledTimes(1);
    expect(repository.saveAdvisorRun).not.toHaveBeenCalled();
  });

  it("persists a fresh run when no matching cached analysis exists", async () => {
    const state = createDashboardState({
      bills: [
        createBill({
          id: "overdue",
          name: "Overdue",
          category: "Debt",
          status: "Past Due",
          amount: 260,
          dueDate: getOffsetDateString(-3),
          lateFeeAmount: 20,
        }),
      ],
    });
    const preference = createPreference({ strategy: "reduce-overdue-count" });
    const repository = createRepository(state, preference);

    const result = await runAdvisorAnalysisForUser(
      {
        userId: "user-1",
        context: "planning",
        reportingRange: "month",
      },
      repository,
    );

    expect(result.response.metadata.cacheStatus).toBe("fresh");
    expect(result.response.metadata.runId).toBe("saved-run");
    expect(repository.saveAdvisorRun).toHaveBeenCalledTimes(1);
    expect(repository.saveAdvisorRun.mock.calls[0]?.[0].factsVersion).toBe(
      ADVISOR_FACTS_VERSION,
    );
  });

  it("persists advisor preferences through the repository layer", async () => {
    const repository = createRepository(createDashboardState());
    const nextPreference = createPreference({
      strategy: "preserve-cash-buffer",
      minimumCashBuffer: 350,
    });

    const result = await saveAdvisorPreferenceForUser(
      "user-1",
      nextPreference,
      repository,
    );

    expect(result).toEqual(nextPreference);
    expect(repository.saveAdvisorPreference).toHaveBeenCalledWith(
      "user-1",
      nextPreference,
    );
  });

  it("records advisor actions with the current summary snapshot and inferred associations", async () => {
    const state = createDashboardState({
      bills: [
        createBill({
          id: "power",
          name: "Power",
          category: "Utilities",
          amount: 145,
          dueDate: getOffsetDateString(2),
        }),
      ],
    });
    const repository = createRepository(
      state,
      createPreference({ strategy: "protect-essentials" }),
    );

    await recordAdvisorActionForUser(
      {
        userId: "user-1",
        context: "planning",
        reportingRange: "month",
        sourceKind: "recommendation",
        sourceId: "filter-utilities",
        sourceLabel: "Filter Utilities",
        actionType: "follow-recommendation",
        action: {
          type: "filterCategory",
          category: "Utilities",
        },
        shownRecommendationIds: ["filter-utilities"],
        shownRecommendationTypes: ["Protect Essentials"],
      },
      repository,
    );

    expect(repository.saveAdvisorAction).toHaveBeenCalledTimes(1);
    expect(repository.saveAdvisorAction.mock.calls[0]?.[0]).toMatchObject({
      strategy: "protect-essentials",
      associatedCategory: "Utilities",
      snapshot: createSummarySnapshot(state),
    });
  });
});
