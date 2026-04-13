export type BillStatus = "Upcoming" | "Past Due" | "Paid";

export type BillCategory =
  | "Debt"
  | "Utilities"
  | "Subscription"
  | "Insurance"
  | "Rent / Housing"
  | "Groceries"
  | "Services"
  | "Other";

export type SortBy = "dueDate" | "status" | "category";
export type SortDirection = "asc" | "desc";

export type Bill = {
  id: string;
  name: string;
  category: BillCategory;
  status: BillStatus;
  dueDate: string;
  amount: number;
  lateFeeAmount?: number;
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentNote?: string;
  notes?: string;
  sourceType?: "manual" | "debt-derived";
  sourceDebtAccountId?: string;
  sourceDebtType?: DebtType;
  sourceDebtOccurrenceDate?: string;
};

export type BillInput = Omit<Bill, "id">;

export type DebtType =
  | "Credit Card"
  | "Auto Loan"
  | "Student Loan"
  | "Installment Loan"
  | "BNPL"
  | "Financed Purchase";

export type DebtPaymentCadence = "Monthly" | "Biweekly" | "Weekly";

export type DebtLifecycleState = "Active" | "Deferment" | "Closed With Balance";

export type DebtPaymentRequirement = "Payment Required" | "No Payment Required";

export type DebtInterestAccrual = "Interest Accruing" | "No Interest Accruing";

export type DebtAccount = {
  id: string;
  providerName: string;
  debtType: DebtType;
  currentBalance: number;
  originalAmount?: number;
  apr?: number;
  creditLimit?: number;
  termLengthMonths?: number;
  totalPaymentCount?: number;
  completedPaymentCount?: number;
  paymentCadence: DebtPaymentCadence;
  nextDueDate?: string;
  minimumPayment?: number;
  scheduledPaymentAmount?: number;
  lifecycleState: DebtLifecycleState;
  paymentRequirement: DebtPaymentRequirement;
  interestAccrual: DebtInterestAccrual;
  isDelinquent?: boolean;
  notes?: string;
};

export type DashboardState = {
  startingBalance: number;
  includePaidInTotals: boolean;
  bills: Bill[];
  debtAccounts?: DebtAccount[];
  advisorTracking?: AdvisorTrackingEvent[];
  advisorWorkspace?: AdvisorWorkspaceState;
};

export type DebtSummary = {
  totalDebtBalance: number;
  activeAccountCount: number;
  delinquentAccountCount: number;
  noPaymentRequiredCount: number;
  totalMinimumDueIn60Days: number;
  nextDebtDueDate?: string;
  nextDebtDueAmount: number;
};

export type DebtMathTrustState = "Exact" | "Estimated" | "Limited" | "Custom" | "Manual";

export type DebtMathInspectableItem = {
  label: string;
  value: string;
  state: DebtMathTrustState;
  note?: string;
};

export type DebtPayoffScenario = {
  id: string;
  label: string;
  extraPaymentAmount: number;
  totalPaymentAmount: number;
  payoffDate?: string;
  monthsSaved?: number;
  projectedInterestSaved?: number;
  trustState: DebtMathTrustState;
  note?: string;
};

export type DebtPayoffProjection = {
  methodLabel: string;
  payoffDate?: string;
  payoffDateTrustState: DebtMathTrustState;
  projectedRemainingInterest?: number;
  projectedRemainingInterestTrustState: DebtMathTrustState;
  paymentAmountUsed: number;
  paymentAmountTrustState: DebtMathTrustState;
  limitationNote?: string;
  inputs: DebtMathInspectableItem[];
  assumptions: DebtMathInspectableItem[];
  scenarios: DebtPayoffScenario[];
};

export type DebtDerivedMetrics = {
  nextScheduledPaymentAmount: number;
  nextScheduledPaymentDate?: string;
  remainingBalance: number;
  remainingPaymentCount?: number;
  remainingPaymentCountTrustState?: DebtMathTrustState;
  payoffDateProjection?: string;
  payoffTrustState: DebtMathTrustState;
  projectedRemainingInterest?: number;
  projectedRemainingInterestTrustState: DebtMathTrustState;
  paymentAmountTrustState: DebtMathTrustState;
  utilizationPercent?: number;
  estimatedMonthlyInterest?: number;
  estimatedMonthlyInterestTrustState?: DebtMathTrustState;
  installmentProgressLabel?: string;
  installmentProgressTrustState?: DebtMathTrustState;
  trustNotes: string[];
  projection: DebtPayoffProjection;
};

export type DebtScheduleItem = {
  id: string;
  debtAccountId: string;
  dueDate: string;
  amount: number;
  status: BillStatus;
  sourceBillId: string;
};

export type RunningBalanceRow = {
  billId: string;
  countedAmount: number;
  runningTotal: number;
  remainingBalance: number;
};

export type CategoryBreakdownItem = {
  category: BillCategory;
  count: number;
  pastDueCount: number;
  total: number;
};

export type DashboardSummary = {
  totalBills: number;
  numberOfBills: number;
  balanceLeft: number;
  negativeAmount: number;
  activeBillCount: number;
  allBillsTotal: number;
  pastDueCount: number;
  paidTotal: number;
  unpaidTotal: number;
  categoryBreakdown: CategoryBreakdownItem[];
  dueIn7DaysCount: number;
  dueIn7DaysTotal: number;
  dueThisMonthTotal: number;
  nextBillDueDate?: string;
  nextBillDueAmount: number;
  totalLateFees: number;
  billsWithLateFees: number;
  lateFeePercentOfTotal: number;
  highestLateFee: number;
};

export type ReportingRange = "day" | "week" | "month" | "year";

export type ReportingCategoryBreakdownItem = {
  category: BillCategory;
  total: number;
  percentOfTotal: number;
  billCount: number;
  lateFees: number;
};

export type ReportingStatusBreakdownItem = {
  status: BillStatus;
  count: number;
  total: number;
  percentOfTotal: number;
};

export type ReportingTrendPoint = {
  key: string;
  label: string;
  total: number;
  lateFees: number;
  billCount: number;
  paidCount: number;
  pastDueCount: number;
};

export type ReportingDelta = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
};

export type ReportingSnapshot = {
  range: ReportingRange;
  periodStart: string;
  periodEnd: string;
  previousPeriodStart: string;
  previousPeriodEnd: string;
  periodLabel: string;
  totalBills: number;
  totalPaid: number;
  totalUnpaid: number;
  totalLateFees: number;
  averageBillAmount: number;
  highestBillAmount: number;
  highestLateFee: number;
  numberOfBills: number;
  numberOfPaidBills: number;
  numberOfUpcomingBills: number;
  numberOfPastDueBills: number;
  numberOfBillsWithLateFees: number;
  lateFeesPercentOfTotal: number;
  paidPercent: number;
  unpaidPercent: number;
  categoryBreakdown: ReportingCategoryBreakdownItem[];
  statusBreakdown: ReportingStatusBreakdownItem[];
  trend: ReportingTrendPoint[];
  topCategory?: BillCategory;
  topCategoryPercent: number;
  biggestLateFeeCategory?: BillCategory;
  mostExpensiveBill?: {
    id: string;
    name: string;
    category: BillCategory;
    amount: number;
    dueDate: string;
  };
  largestLateFeeBill?: {
    id: string;
    name: string;
    category: BillCategory;
    lateFeeAmount: number;
    dueDate: string;
  };
  totalBillsDelta: ReportingDelta;
  totalLateFeesDelta: ReportingDelta;
  pastDueCountDelta: ReportingDelta;
  billCountDelta: ReportingDelta;
};

export type AdvisorContext = "overview" | "planning" | "reporting" | "all";

export type AdvisorCategory =
  | "Priority Alert"
  | "Recommendation"
  | "Trend Commentary"
  | "Preventive Guidance";

export type AdvisorPriority = "Critical" | "High" | "Medium";

export type AdvisorConfidence = "High" | "Medium" | "Light";

export type AdvisorRecommendationType =
  | "Priority Alert"
  | "Pay First"
  | "Watch Next"
  | "Prevent Fee Risk"
  | "Cash Preservation Move"
  | "Reduce Upcoming Pressure"
  | "Protect Essentials"
  | "Biggest Category Risk"
  | "Trend Warning"
  | "Improvement Signal";

export type AdvisorStrategyMode =
  | "reduce-overdue-count"
  | "minimize-late-fees"
  | "protect-essentials"
  | "preserve-cash-buffer"
  | "snowball"
  | "avalanche";

export type AdvisorPreference = {
  strategy: AdvisorStrategyMode;
  minimumCashBuffer: number;
};

export type AdvisorDataQualityLevel = "Strong" | "Moderate" | "Sparse";

export type AdvisorDataQuality = {
  level: AdvisorDataQualityLevel;
  score: number;
  summary: string;
  issues: string[];
};

export type AdvisorScenarioType =
  | "pay-strategy-bill-first"
  | "pay-smallest-overdue-first"
  | "pay-largest-overdue-first"
  | "clear-all-past-due"
  | "wait-7-days"
  | "pay-fee-bills-first"
  | "pay-essentials-first"
  | "focus-top-category";

export type AdvisorScenarioPriority = "Best Fit" | "Safest" | "Useful" | "Defensive";

export type AdvisorScenarioResult = {
  id: string;
  type: AdvisorScenarioType;
  priority: AdvisorScenarioPriority;
  title: string;
  description: string;
  bestFor?: string;
  effectSummary: string;
  projectedBalanceLeft: number;
  projectedNegativeAmount: number;
  projectedPastDueCount: number;
  projectedUnpaidTotal: number;
  projectedActiveBillCount: number;
  projectedLateFeeTotal: number;
  balanceLeftDelta: number;
  negativeAmountDelta: number;
  pastDueCountDelta: number;
  unpaidTotalDelta: number;
  activeBillCountDelta: number;
  lateFeeTotalDelta: number;
  categoryPressureNote?: string;
  riskNote?: string;
  tradeoffSummary?: string;
  winnerReason?: string;
  rankingReason?: string;
  strategyInfluence?: string;
  limitationNote?: string;
  signals: string[];
  focusBillId?: string;
  focusCategory?: BillCategory;
  action?: AdvisorAction;
  actionLabel?: string;
};

export type AdvisorTrackingEventType =
  | "analysis-run"
  | "follow-recommendation"
  | "follow-scenario";

export type AdvisorTrackingSnapshot = {
  balanceLeft: number;
  negativeAmount: number;
  pastDueCount: number;
  unpaidTotal: number;
  totalLateFees: number;
  dueIn7DaysCount: number;
  dueIn7DaysTotal: number;
};

export type AdvisorTrackingEvent = {
  id: string;
  type: AdvisorTrackingEventType;
  timestamp: number;
  context: AdvisorContext;
  strategy: AdvisorStrategyMode;
  sourceId?: string;
  sourceLabel?: string;
  shownRecommendationIds?: string[];
  shownRecommendationTypes?: AdvisorRecommendationType[];
  shownFocusBillIds?: string[];
  shownFocusCategories?: BillCategory[];
  shownScenarioTypes?: AdvisorScenarioType[];
  dataQualityLevel?: AdvisorDataQualityLevel;
  snapshot: AdvisorTrackingSnapshot;
};

export type AdvisorTrackingSummary = {
  followedCount: number;
  lastFollowedAt?: number;
  analysisRunCount?: number;
  recentRepeatExposureCount?: number;
  note?: string;
};

export type AdvisorRecommendationLifecycleState =
  | "generated"
  | "surfaced"
  | "viewed"
  | "saved"
  | "snoozed"
  | "acted-on"
  | "resolved"
  | "expired"
  | "replaced"
  | "not-possible-this-week";

export type AdvisorReminderType =
  | "before-due-date"
  | "after-payday"
  | "recheck-run"
  | "repeat-fee-risk"
  | "stale-analysis";

export type AdvisorFreshnessState =
  | "Fresh"
  | "Possibly stale"
  | "Stale - refresh recommended"
  | "Invalid - refresh required";

export type AdvisorAction =
  | { type: "goToOverview" }
  | { type: "goToBills" }
  | { type: "goToReporting" }
  | { type: "filterPastDue" }
  | { type: "filterDueSoon" }
  | { type: "filterCategory"; category: BillCategory }
  | { type: "searchBill"; query: string }
  | { type: "markDone" }
  | { type: "snooze" }
  | { type: "notPossibleThisWeek" }
  | { type: "remindLater"; reminderType?: AdvisorReminderType }
  | { type: "pinToHub" }
  | { type: "watchBill"; billId?: string }
  | { type: "watchCategory"; category?: BillCategory }
  | { type: "watchRepeatFeeRisk"; category?: BillCategory };

export type AdvisorRecommendationStateRecord = {
  recommendationId: string;
  title: string;
  context: AdvisorContext;
  recommendationType: AdvisorRecommendationType;
  state: AdvisorRecommendationLifecycleState;
  priority: AdvisorPriority;
  focusBillId?: string;
  focusCategory?: BillCategory;
  whyNow?: string;
  note?: string;
  pinnedToHub?: boolean;
  reminderType?: AdvisorReminderType;
  reminderAt?: string;
  snoozedUntil?: string;
  surfacedAt: string;
  lastUpdatedAt: string;
  resolvedAt?: string;
};

export type AdvisorPinnedScenario = {
  scenarioId: string;
  title: string;
  context: AdvisorContext;
  priority: AdvisorScenarioPriority;
  type: AdvisorScenarioType;
  bestFor?: string;
  tradeoffSummary?: string;
  focusBillId?: string;
  focusCategory?: BillCategory;
  pinnedAt: string;
};

export type AdvisorWatch = {
  id: string;
  kind: "bill" | "category" | "repeat-fee-risk" | "analysis-staleness";
  label: string;
  status: "active" | "resolved" | "dismissed";
  focusBillId?: string;
  focusCategory?: BillCategory;
  createdAt: string;
  updatedAt: string;
};

export type AdvisorReminder = {
  id: string;
  type: AdvisorReminderType;
  label: string;
  status: "scheduled" | "completed" | "dismissed";
  recommendationId?: string;
  scenarioId?: string;
  focusBillId?: string;
  focusCategory?: BillCategory;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdvisorObjective =
  | "reduce-late-fees"
  | "protect-cash-buffer"
  | "stabilize-essentials"
  | "clear-past-due"
  | "reduce-debt-drag"
  | "prepare-large-bill"
  | "preserve-goal-fund";

export type AdvisorObjectiveRecord = {
  id: string;
  objective: AdvisorObjective;
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdvisorWorkspaceState = {
  recommendationStates?: AdvisorRecommendationStateRecord[];
  pinnedScenarios?: AdvisorPinnedScenario[];
  watches?: AdvisorWatch[];
  reminders?: AdvisorReminder[];
  objectives?: AdvisorObjectiveRecord[];
  lastOpenHubSection?: string;
};

export type AdvisorItem = {
  id: string;
  category: AdvisorCategory;
  recommendationType: AdvisorRecommendationType;
  priority: AdvisorPriority;
  confidence: AdvisorConfidence;
  title: string;
  recommendation: string;
  why: string;
  impact: string;
  score: number;
  signals: string[];
  focusBillId?: string;
  focusCategory?: BillCategory;
  whyNow?: string;
  mainReason?: string;
  supportingFactors?: string[];
  caveat?: string;
  whatWouldChange?: string;
  rankingReason?: string;
  strategyInfluence?: string;
  limitationNote?: string;
  action?: AdvisorAction;
  actionLabel?: string;
};

export type AdvisorDeltaSummary = {
  headline: string;
  details: string[];
  previousRunId?: string;
};

export type AdvisorLadderStep = {
  slot: "Now" | "Next" | "Then";
  recommendationId?: string;
  title: string;
  description: string;
  focusBillId?: string;
  focusCategory?: BillCategory;
  whyNow?: string;
  action?: AdvisorAction;
  actionLabel?: string;
};

export type AdvisorHealthPillarName =
  | "Control"
  | "Resilience"
  | "Trajectory"
  | "Flexibility";

export type AdvisorHealthPillar = {
  pillar: AdvisorHealthPillarName;
  status: "Strong" | "Guarded" | "Pressured";
  score: number;
  trend: "Improving" | "Flat" | "Worsening";
  summary: string;
  primaryDrivers: string[];
  strongestImprovementLever?: string;
};

export type AdvisorFinancialHealthSnapshot = {
  overallStatus: "Stable" | "Watch" | "Pressured" | "Critical";
  summary: string;
  pillars: AdvisorHealthPillar[];
};

export type AdvisorPressureSignal = {
  id: string;
  pressureType:
    | "overdue-pressure"
    | "late-fee-pressure"
    | "category-concentration"
    | "essentials-fragility"
    | "debt-drag"
    | "subscription-drag"
    | "buffer-instability"
    | "unresolved-recommendations";
  severity: "High" | "Medium" | "Low";
  trend: "Improving" | "Flat" | "Worsening";
  recurrence: "Recurring" | "Occasional" | "New";
  topDriver: string;
  recommendedAction: string;
};

export type AdvisorRecurringProblemArea = {
  id: string;
  title: string;
  summary: string;
  recurrenceCount: number;
  lastSeenAt?: string;
  focusBillId?: string;
  focusCategory?: BillCategory;
};

export type AdvisorPeriodReview = {
  periodLabel: string;
  biggestPressure: string;
  biggestImprovement: string;
  feesAdded: number;
  feesAvoided: number;
  topUnresolvedIssue?: string;
  followThroughRate: number;
  healthTrend: "Improved" | "Flat" | "Worsened";
  mostUsedStrategy?: AdvisorStrategyMode;
};

export type AdvisorEffectivenessMetrics = {
  recommendationActionRate: number;
  recommendationCompletionRate: number;
  resolvedCount: number;
  unresolvedCount: number;
  snoozedCount: number;
  pinnedScenarioCount: number;
  repeatPressureRate: number;
  averageTimeToResolutionDays?: number;
  bestPerformingStrategy?: AdvisorStrategyMode;
};

export type AdvisorConfidenceBreakdown = {
  overall: AdvisorConfidence;
  dataDepth: "Strong" | "Moderate" | "Weak";
  historyDepth: "Strong" | "Moderate" | "Weak";
  trendQuality: "Strong" | "Moderate" | "Weak";
  scenarioSeparation: "Strong" | "Moderate" | "Weak";
  actionCertainty: "Strong" | "Moderate" | "Weak";
  blockers: string[];
};

export const BILL_CATEGORIES: BillCategory[] = [
  "Debt",
  "Utilities",
  "Subscription",
  "Insurance",
  "Rent / Housing",
  "Groceries",
  "Services",
  "Other",
];

export const BILL_STATUSES: BillStatus[] = ["Upcoming", "Past Due", "Paid"];

export const DEBT_TYPES: DebtType[] = [
  "Credit Card",
  "Auto Loan",
  "Student Loan",
  "Installment Loan",
  "BNPL",
  "Financed Purchase",
];

export const DEBT_PAYMENT_CADENCES: DebtPaymentCadence[] = [
  "Monthly",
  "Biweekly",
  "Weekly",
];

export const DEBT_LIFECYCLE_STATES: DebtLifecycleState[] = [
  "Active",
  "Deferment",
  "Closed With Balance",
];

export const DEBT_PAYMENT_REQUIREMENTS: DebtPaymentRequirement[] = [
  "Payment Required",
  "No Payment Required",
];

export const DEBT_INTEREST_ACCRUAL_OPTIONS: DebtInterestAccrual[] = [
  "Interest Accruing",
  "No Interest Accruing",
];
