import type {
  AdvisorAction,
  AdvisorConfidenceBreakdown,
  AdvisorContext,
  AdvisorDataQuality,
  AdvisorDeltaSummary,
  AdvisorEffectivenessMetrics,
  AdvisorFinancialHealthSnapshot,
  AdvisorFreshnessState,
  AdvisorItem,
  AdvisorLadderStep,
  AdvisorPeriodReview,
  AdvisorPreference,
  AdvisorPressureSignal,
  AdvisorRecurringProblemArea,
  AdvisorRecommendationStateRecord,
  AdvisorScenarioResult,
  AdvisorTrackingEvent,
  AdvisorTrackingSummary,
  AdvisorWatch,
  AdvisorReminder,
  AdvisorPinnedScenario,
  AdvisorObjectiveRecord,
  Bill,
  DebtAccount,
  DebtDownstreamSnapshot,
  DashboardSummary,
  ReportingRange,
  ReportingSnapshot,
} from "@/lib/types";

export const ADVISOR_FACTS_VERSION = "v3.5";
export const ADVISOR_PROVIDER_NAME = "deterministic-core";
export const ADVISOR_PROVIDER_VERSION = "v3.5";

export type AdvisorFacts = {
  version: typeof ADVISOR_FACTS_VERSION;
  context: AdvisorContext;
  reportingRange: ReportingRange;
  startingBalance: number;
  includePaidInTotals: boolean;
  preference: AdvisorPreference;
  bills: Bill[];
  summary: DashboardSummary;
  reporting: ReportingSnapshot;
  tracking: AdvisorTrackingEvent[];
  source: {
    kind: "supabase";
    userId: string;
    dashboardUpdatedAt?: string;
    debtAccounts: DebtAccount[];
    debtSnapshot: DebtDownstreamSnapshot;
  };
};

export type AdvisorResponseSummary = {
  headline: string;
  description: string;
  criticalCount: number;
  recommendationCount: number;
  scenarioCount: number;
};

export type AdvisorResponseTrust = {
  explainability: string;
  signalsUsed: string[];
  dataQuality: AdvisorDataQuality;
  tracking: AdvisorTrackingSummary;
  limitationSummary?: string;
};

export type AdvisorResponseMetadata = {
  context: AdvisorContext;
  reportingRange: ReportingRange;
  strategy: AdvisorPreference["strategy"];
  minimumCashBuffer: number;
  provider: string;
  providerVersion: string;
  factsVersion: string;
  factsHash?: string;
  analyzedAt?: string;
  runId?: string;
  cacheStatus: "fresh" | "cached" | "stale";
  stale: boolean;
  freshness: AdvisorFreshnessState;
  derivedFromRunId?: string;
  derivedFromContext?: AdvisorContext;
};

export type AdvisorResponse = {
  summary: AdvisorResponseSummary;
  ladder: AdvisorLadderStep[];
  deltaSinceLastRun?: AdvisorDeltaSummary;
  rankedItems: AdvisorItem[];
  sections: {
    priorityAlerts: AdvisorItem[];
    recommendations: AdvisorItem[];
    preventiveGuidance: AdvisorItem[];
    trendCommentary: AdvisorItem[];
  };
  scenarios: AdvisorScenarioResult[];
  trust: AdvisorResponseTrust;
  recommendationStates?: AdvisorRecommendationStateRecord[];
  metadata: AdvisorResponseMetadata;
};

export type AdvisorProviderOutput = Omit<AdvisorResponse, "metadata">;

export type AdvisorProvider = {
  name: string;
  version: string;
  analyze: (facts: AdvisorFacts) => AdvisorProviderOutput;
};

export type AdvisorRunRecord = {
  id: string;
  userId: string;
  context: AdvisorContext;
  reportingRange: ReportingRange;
  strategy: AdvisorPreference["strategy"];
  minimumCashBuffer: number;
  provider: string;
  providerVersion: string;
  factsVersion: string;
  factsHash: string;
  response: AdvisorResponse;
  summarySnapshot: AdvisorTrackingEvent["snapshot"];
  dataQualityLevel?: AdvisorDataQuality["level"];
  createdAt: string;
};

export type AdvisorRunHistoryEntry = {
  id: string;
  context: AdvisorContext;
  reportingRange: ReportingRange;
  strategy: AdvisorPreference["strategy"];
  minimumCashBuffer: number;
  createdAt: string;
  headline: string;
  description: string;
  criticalCount: number;
  recommendationCount: number;
  scenarioCount: number;
  dataQualityLevel?: AdvisorDataQuality["level"];
  summarySnapshot: AdvisorTrackingEvent["snapshot"];
};

export type AdvisorHubResponse = {
  context: "all";
  reportingRange: ReportingRange;
  latestAnalysis: AdvisorResponse | null;
  history: AdvisorRunHistoryEntry[];
  executiveSummary: {
    biggestProblem: string;
    bestNextMove: string;
    strongestImprovementLever: string;
    topRecurringIssue?: string;
    watchNext?: string;
  };
  financialHealth: AdvisorFinancialHealthSnapshot | null;
  pressureMap: AdvisorPressureSignal[];
  recurringProblemAreas: AdvisorRecurringProblemArea[];
  periodReview?: AdvisorPeriodReview;
  effectiveness: AdvisorEffectivenessMetrics;
  confidenceBreakdown?: AdvisorConfidenceBreakdown;
  workspace: {
    recommendationQueue: AdvisorRecommendationStateRecord[];
    completedActions: AdvisorRecommendationStateRecord[];
    snoozedItems: AdvisorRecommendationStateRecord[];
    pinnedScenarios: AdvisorPinnedScenario[];
    watches: AdvisorWatch[];
    reminders: AdvisorReminder[];
    objectives: AdvisorObjectiveRecord[];
  };
};

export type AdvisorActionRecord = {
  id: string;
  userId: string;
  advisorRunId?: string;
  context: AdvisorContext;
  reportingRange: ReportingRange;
  strategy: AdvisorPreference["strategy"];
  actionType: AdvisorTrackingEvent["type"];
  sourceKind: "recommendation" | "scenario";
  sourceId?: string;
  sourceLabel?: string;
  associatedBillId?: string;
  associatedCategory?: Bill["category"];
  snapshot: AdvisorTrackingEvent["snapshot"];
  metadata: {
    action?: AdvisorAction;
    dataQualityLevel?: AdvisorDataQuality["level"];
    shownRecommendationIds?: string[];
    shownRecommendationTypes?: string[];
    shownFocusBillIds?: string[];
    shownFocusCategories?: string[];
    shownScenarioTypes?: string[];
  };
  createdAt: string;
};
