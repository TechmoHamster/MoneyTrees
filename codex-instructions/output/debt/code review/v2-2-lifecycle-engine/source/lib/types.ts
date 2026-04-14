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
  | "Mortgage"
  | "Credit Card"
  | "Auto Loan"
  | "Student Loan"
  | "Other Loan"
  | "Line of Credit"
  | "Installment Loan"
  | "BNPL"
  | "Financed Purchase";

export type DebtPaymentCadence = "Monthly" | "Biweekly" | "Weekly";

export type DebtLifecycleState = "Active" | "Deferment" | "Closed With Balance";

export type DebtStandingState =
  | "current"
  | "grace_window"
  | "late"
  | "delinquent"
  | "cured"
  | "closed_with_balance"
  | "charged_off"
  | "collections"
  | "resolved"
  | "paid_off"
  | "inactive";

export type DebtPaymentRequirement = "Payment Required" | "No Payment Required";

export type DebtInterestAccrual = "Interest Accruing" | "No Interest Accruing";

export type DebtPromoType = "Intro APR" | "Deferred Interest";

export type DebtGracePeriodStatus =
  | "Grace Period Active"
  | "Grace Period Lost"
  | "Grace Period Regain Pending"
  | "Grace Period Regained";

export type DebtRateStructure = "Fixed" | "Adjustable" | "Variable";

export type DebtStudentLoanKind = "Federal" | "Private";

export type DebtSourceQuality =
  | "lender_confirmed"
  | "user_entered"
  | "estimated_default"
  | "system_derived"
  | "manual_confirmed";

export type DebtArrangementOverlayType =
  | "hardship_active"
  | "deferment"
  | "forbearance"
  | "reduced_payment_arrangement"
  | "settlement_active"
  | "dispute_active"
  | "collector_payment_plan"
  | "temporary_skip_approved";

export type DebtArrangementOverlay = {
  id: string;
  type: DebtArrangementOverlayType;
  startDate: string;
  endDate?: string;
  status: "active" | "ended";
  sourceQuality: DebtSourceQuality;
  temporaryRequiredPayment?: number;
  interestAccrues?: boolean;
  pauseStandingProgression?: boolean;
  notes?: string;
};

export type DebtLifecycleEventType =
  | "payment_posted"
  | "partial_payment_posted"
  | "payment_pending"
  | "payment_failed"
  | "payment_reversed"
  | "late_fee_applied"
  | "returned_payment_fee_applied"
  | "standing_state_changed"
  | "arrangement_started"
  | "arrangement_ended"
  | "interest_capitalized"
  | "apr_changed"
  | "payment_recast"
  | "promo_expired"
  | "transfer_started"
  | "transfer_completed"
  | "account_closed"
  | "collections_confirmed"
  | "settlement_started"
  | "settlement_completed"
  | "account_cured"
  | "account_resolved";

export type DebtContinuityEventType =
  | "balance_transfer"
  | "refinance"
  | "consolidation"
  | "servicer_transfer"
  | "debt_sale"
  | "account_replacement";

export type DebtLifecycleEvent = {
  id: string;
  eventType: DebtLifecycleEventType;
  effectiveDate: string;
  recordedDate?: string;
  source: string;
  sourceQuality: DebtSourceQuality;
  reversible: boolean;
  correctedEventId?: string;
  relatedBillId?: string;
  amount?: number;
  standingState?: DebtStandingState;
  arrangementType?: DebtArrangementOverlayType;
  continuityEventType?: DebtContinuityEventType;
  note?: string;
};

export type DebtTermVersion = {
  id: string;
  effectiveDate: string;
  sourceQuality: DebtSourceQuality;
  apr?: number;
  rateStructure?: DebtRateStructure;
  minimumPayment?: number;
  scheduledPaymentAmount?: number;
  minimumPaymentMode?: CreditCardMinimumPaymentMode;
  minimumPaymentPresetId?: CreditCardPresetRuleId;
  paymentAssumptionMode?: CreditCardPaymentAssumptionMode;
  paymentAssumptionCustomAmount?: number;
  gracePeriodStatus?: DebtGracePeriodStatus;
  promoType?: DebtPromoType;
  promoEndDate?: string;
  termLengthMonths?: number;
  capitalizationBehavior?: "capitalize_accrued_interest" | "no_capitalization";
  notes?: string;
};

export type DebtContinuity = {
  obligationChainId?: string;
  predecessorAccountId?: string;
  successorAccountId?: string;
  continuityEventType?: DebtContinuityEventType;
  continuityEffectiveDate?: string;
  transferredAmount?: number;
  closureReason?: string;
};

export type DebtSourceConflict = {
  id: string;
  type:
    | "payment-status-conflict"
    | "arrangement-rule-conflict"
    | "continuity-balance-conflict"
    | "settlement-balance-conflict"
    | "duplicate-event-conflict";
  summary: string;
  detail: string;
  severity: "warning" | "critical";
  requiresConfirmation: boolean;
};

export type DebtLifecyclePolicy = {
  graceWindowDays: number;
  lateThresholdDays: number;
  delinquencyThresholdDays: number;
  hardshipPausesStandingProgression: boolean;
  temporarySkipPausesStandingProgression: boolean;
  partialPaymentAllocationRule:
    | "fees-then-past-due-then-scheduled"
    | "scheduled-then-fees"
    | "manual-or-lender-defined";
  lateFeesCountTowardCure: boolean;
};

export type CreditCardMinimumPaymentMode =
  | "Preset Rule"
  | "Custom Rule"
  | "Manual Minimum Amount";

export type CreditCardPaymentAssumptionMode =
  | "Minimum Due"
  | "Statement Balance"
  | "Total Balance"
  | "Custom Amount";

export type CreditCardPresetRuleId =
  | "greater-of-flat-or-percent-statement"
  | "interest-fees-plus-percent-principal"
  | "percent-of-statement-balance"
  | "percent-of-current-balance"
  | "full-balance-below-threshold"
  | "flat-minimum-unless-smaller"
  | "flat-minimum-plus-past-due"
  | "percent-plus-interest-fees-past-due";

export type CreditCardRuleValidationState =
  | "Valid"
  | "Incomplete"
  | "Broken"
  | "Missing Required Inputs";

export type CreditCardRuleMatchStatus =
  | "Exact Match"
  | "Close Match"
  | "Does Not Match";

export type CreditCardRuleVariable =
  | "statement_balance"
  | "current_balance"
  | "interest_charged"
  | "fees_charged"
  | "past_due_amount"
  | "late_fee_amount"
  | "promo_balance"
  | "regular_purchase_balance"
  | "cash_advance_balance"
  | "balance_subject_to_minimum";

export type CreditCardCustomRuleOperationMode =
  | "Percent Only"
  | "Flat Only"
  | "Percent Plus Flat"
  | "Greater Of Flat Or Percent"
  | "Lesser Of Flat Or Percent";

export type CreditCardCustomMinimumRule = {
  name: string;
  principalVariable: CreditCardRuleVariable;
  operationMode: CreditCardCustomRuleOperationMode;
  percentageValue?: number;
  fixedAmount?: number;
  thresholdAmount?: number;
  useFullBalanceBelowThreshold: boolean;
  includeInterestCharged: boolean;
  includeFeesCharged: boolean;
  includePastDueAmount: boolean;
  includeLateFeeAmount: boolean;
  includePromoBalance: boolean;
  includeRegularPurchaseBalance: boolean;
  includeCashAdvanceBalance: boolean;
};

export type CreditCardRulePreview = {
  id: string;
  ruleName: string;
  plainEnglishExplanation: string;
  formulaSummary: string;
  formulaExpression: string;
  supportLabel: string;
  supportDetail: string;
  calculatedMinimumPayment?: number;
  validationState: CreditCardRuleValidationState;
  confidenceState: DebtMathTrustState;
  matchStatus?: CreditCardRuleMatchStatus;
  statementComparisonDelta?: number;
  overlapWarnings: string[];
  saveBlockedByOverlap?: boolean;
  missingInputs: string[];
};

export type CreditCardMinimumSystem = {
  issuerDisplayName: string;
  accountIdentity: string;
  currentMinimumPayment?: number;
  currentMinimumPaymentTrustState: DebtMathTrustState;
  minimumPaymentMode: CreditCardMinimumPaymentMode;
  paymentAssumptionMode: CreditCardPaymentAssumptionMode;
  paymentAssumptionAmount?: number;
  paymentAssumptionTrustState: DebtMathTrustState;
  activeRuleName: string;
  activeRuleExplanation: string;
  activeFormulaSummary: string;
  activeFormulaExpression: string;
  activeRuleSupportLabel: string;
  activeRuleSupportDetail: string;
  activeRuleOverlapWarnings: string[];
  validationState: CreditCardRuleValidationState;
  confidenceState: DebtMathTrustState;
  lastVerifiedAgainstStatement?: string;
  statementMinimumLastEntered?: number;
  statementMatchStatus?: CreditCardRuleMatchStatus;
  statementComparisonDelta?: number;
  currentFormulaInputs: DebtMathInspectableItem[];
  missingDataWarnings: string[];
  presetLibrary: CreditCardRulePreview[];
  selectedPresetPreview?: CreditCardRulePreview;
  customRulePreview?: CreditCardRulePreview;
};

export type DebtAccount = {
  id: string;
  providerName: string;
  issuerName?: string;
  debtType: DebtType;
  assetName?: string;
  merchantName?: string;
  loanPurpose?: string;
  isSecured?: boolean;
  collateralDescription?: string;
  currentBalance: number;
  originalAmount?: number;
  availableCredit?: number;
  statementBalance?: number;
  statementMinimumDue?: number;
  apr?: number;
  rateStructure?: DebtRateStructure;
  creditLimit?: number;
  interestCharged?: number;
  feesCharged?: number;
  accruedInterestBalance?: number;
  capitalizedInterestTotal?: number;
  pastDueAmount?: number;
  daysPastDue?: number;
  lateFeeAmount?: number;
  promoType?: DebtPromoType;
  promoEndDate?: string;
  promoBalance?: number;
  regularPurchaseBalance?: number;
  cashAdvanceBalance?: number;
  gracePeriodStatus?: DebtGracePeriodStatus;
  statementClosingDate?: string;
  termLengthMonths?: number;
  totalPaymentCount?: number;
  completedPaymentCount?: number;
  paymentCadence: DebtPaymentCadence;
  startDate?: string;
  maturityDate?: string;
  nextDueDate?: string;
  finalPaymentDate?: string;
  minimumPayment?: number;
  scheduledPaymentAmount?: number;
  minimumPaymentMode?: CreditCardMinimumPaymentMode;
  minimumPaymentPresetId?: CreditCardPresetRuleId;
  minimumPaymentCustomRule?: CreditCardCustomMinimumRule;
  paymentAssumptionMode?: CreditCardPaymentAssumptionMode;
  paymentAssumptionCustomAmount?: number;
  lastVerifiedAgainstStatement?: string;
  autoPayEnabled?: boolean;
  escrowIncluded?: boolean;
  taxesIncluded?: boolean;
  insuranceIncluded?: boolean;
  monthlyEscrowAmount?: number;
  studentLoanKind?: DebtStudentLoanKind;
  studentLoanType?: string;
  repaymentStatus?: string;
  repaymentPlan?: string;
  forgivenessTrackingNeeded?: boolean;
  vehicleValue?: number;
  insuranceRequired?: boolean;
  drawPeriodEndDate?: string;
  repaymentPeriodStartDate?: string;
  deferredInterestApplies?: boolean;
  hasProviderFeesOrInterest?: boolean;
  lifecycleState: DebtLifecycleState;
  paymentRequirement: DebtPaymentRequirement;
  interestAccrual: DebtInterestAccrual;
  isDelinquent?: boolean;
  arrangementOverlays?: DebtArrangementOverlay[];
  termVersions?: DebtTermVersion[];
  lifecycleEvents?: DebtLifecycleEvent[];
  continuity?: DebtContinuity;
  sourceConflicts?: DebtSourceConflict[];
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
  lateAccountCount: number;
  noPaymentRequiredCount: number;
  activeHardshipCount: number;
  failedPaymentCount: number;
  collectionsCount: number;
  amountNeededToCureTotal: number;
  requiredPaymentsIn14Days: number;
  requiredPaymentsIn30Days: number;
  requiredPaymentsIn60Days: number;
  minimumCashNeededIn14Days: number;
  minimumCashNeededIn30Days: number;
  minimumCashNeededIn60Days: number;
  totalMinimumDueIn60Days: number;
  nextDebtDueDate?: string;
  nextDebtDueAmount: number;
  timingClusterCount: number;
  timingClusterNote?: string;
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

export type DebtCashWindowDays = 14 | 30 | 60;

export type DebtCashWindow = {
  windowDays: DebtCashWindowDays;
  requiredPaymentTotal: number;
  minimumCashNeededToStayCurrent: number;
  dueCount: number;
  nextDueDate?: string;
  timingPressureNote?: string;
};

export type DebtTimingCluster = {
  count: number;
  startDate: string;
  endDate: string;
  totalAmount: number;
  note: string;
};

export type DebtFactualFlagType =
  | "Delinquent"
  | "Past Due / Behind"
  | "Grace Window"
  | "Due Soon"
  | "Payment Due Soon"
  | "Promo Expiring Soon"
  | "High Utilization"
  | "Interest Accruing"
  | "No Payment Required"
  | "Interest Accruing While No Payment Required"
  | "Closed With Balance"
  | "Timing Cluster Forming"
  | "Failed Payment"
  | "Payment Reversed"
  | "Hardship Active"
  | "Forbearance Active"
  | "Collections Confirmed"
  | "Settlement Active"
  | "Dispute Active"
  | "Variable Rate Risk"
  | "Secured Debt Exposure"
  | "BNPL Stacking Risk"
  | "Deferred Interest Risk"
  | "Draw Period Ending"
  | "Negative Equity"
  | "Interest Capitalized"
  | "Source Conflict Present"
  | "Missing Key Inputs Limiting Reliability";

export type DebtFactualFlag = {
  id: string;
  type: DebtFactualFlagType;
  label: string;
  detail?: string;
};

export type DebtConsequenceType =
  | "Late Fee Exposure"
  | "Promo Expiration Risk"
  | "Loss of Grace Period"
  | "Increased Interest Burden"
  | "Closed Account Balance Still Owed"
  | "Delinquency Progression"
  | "Collections Progression"
  | "Settlement Accounting"
  | "Collateral Risk"
  | "Variable Rate Exposure"
  | "Capitalization Growth"
  | "Failed Payment Exposure";

export type DebtConsequenceItem = {
  id: string;
  type: DebtConsequenceType;
  label: string;
  detail: string;
};

export type DebtLifecycleSnapshot = {
  standingState: DebtStandingState;
  standingExplanation: string;
  daysPastDue: number;
  amountNeededToCure: number;
  requiredAmountDue: number;
  partialPaymentReceived: number;
  unpaidAmountAfterPartial: number;
  nextEscalationDate?: string;
  activeOverlays: DebtArrangementOverlay[];
  effectiveTermVersion?: DebtTermVersion;
  eventTimeline: DebtLifecycleEvent[];
  sourceConflicts: DebtSourceConflict[];
  duplicateSuppressedCount: number;
  sourceQualitySummary: string;
  failedPaymentCount: number;
  severeState: boolean;
  gracePeriodState?: DebtGracePeriodStatus;
  continuity?: DebtContinuity;
  policy: DebtLifecyclePolicy;
};

export type DebtDerivedMetrics = {
  lifecycle: DebtLifecycleSnapshot;
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
  creditCardMinimumSystem?: CreditCardMinimumSystem;
  cashWindows: DebtCashWindow[];
  timingCluster?: DebtTimingCluster;
  factualFlags: DebtFactualFlag[];
  consequences: DebtConsequenceItem[];
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

export type DebtPaymentAssumptionFact = {
  label: string;
  amount?: number;
  trustState: DebtMathTrustState;
  detail: string;
};

export type DebtLinkedScheduleFact = {
  billCount: number;
  firstDueDate?: string;
  lastDueDate?: string;
  boundedWindowDays: number;
  editableInBills: false;
  owner: "Debt";
  boundaryNote: string;
};

export type DebtDownstreamObligation = {
  billId: string;
  accountId: string;
  providerName: string;
  debtType: DebtType;
  dueDate: string;
  amount: number;
  status: BillStatus;
};

export type DebtDownstreamAccountFact = {
  accountId: string;
  providerName: string;
  debtType: DebtType;
  standingState: DebtStandingState;
  standingExplanation: string;
  activeOverlays: DebtArrangementOverlay[];
  amountNeededToCure: number;
  daysPastDue: number;
  nextEscalationDate?: string;
  failedPaymentCount: number;
  lifecycleState: DebtLifecycleState;
  paymentRequirement: DebtPaymentRequirement;
  interestAccrual: DebtInterestAccrual;
  currentBalance: number;
  nextScheduledPaymentAmount: number;
  nextScheduledPaymentDate?: string;
  nextScheduledPaymentTrustState: DebtMathTrustState;
  payoffDateProjection?: string;
  payoffTrustState: DebtMathTrustState;
  projectedRemainingInterest?: number;
  projectedRemainingInterestTrustState: DebtMathTrustState;
  paymentAssumption: DebtPaymentAssumptionFact;
  cashWindows: DebtCashWindow[];
  timingCluster?: DebtTimingCluster;
  factualFlags: DebtFactualFlag[];
  consequences: DebtConsequenceItem[];
  extraPaymentImpact: DebtPayoffScenario[];
  linkedSchedule: DebtLinkedScheduleFact;
  eventTimeline: DebtLifecycleEvent[];
  sourceConflicts: DebtSourceConflict[];
  sourceQualitySummary: string;
  continuity?: DebtContinuity;
  primaryConfidenceState: DebtMathTrustState;
  primaryConfidenceDetail: string;
};

export type DebtDownstreamSnapshot = {
  summary: DebtSummary;
  accountFacts: DebtDownstreamAccountFact[];
  nearTermObligations: DebtDownstreamObligation[];
  confidenceSummary: Record<DebtMathTrustState, number>;
  flaggedAccountCount: number;
  consequenceAccountCount: number;
  limitedConfidenceAccountCount: number;
  lifecycleAlertCount: number;
  boundedOperationalWindowDays: number;
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
  "Mortgage",
  "Credit Card",
  "Auto Loan",
  "Student Loan",
  "Other Loan",
  "Line of Credit",
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

export const DEBT_PROMO_TYPES: DebtPromoType[] = ["Intro APR", "Deferred Interest"];

export const DEBT_GRACE_PERIOD_STATUSES: DebtGracePeriodStatus[] = [
  "Grace Period Active",
  "Grace Period Lost",
  "Grace Period Regain Pending",
  "Grace Period Regained",
];

export const DEBT_RATE_STRUCTURES: DebtRateStructure[] = ["Fixed", "Adjustable", "Variable"];

export const DEBT_STUDENT_LOAN_KINDS: DebtStudentLoanKind[] = ["Federal", "Private"];

export const DEBT_STANDING_STATES: DebtStandingState[] = [
  "current",
  "grace_window",
  "late",
  "delinquent",
  "cured",
  "closed_with_balance",
  "charged_off",
  "collections",
  "resolved",
  "paid_off",
  "inactive",
];

export const DEBT_ARRANGEMENT_OVERLAY_TYPES: DebtArrangementOverlayType[] = [
  "hardship_active",
  "deferment",
  "forbearance",
  "reduced_payment_arrangement",
  "settlement_active",
  "dispute_active",
  "collector_payment_plan",
  "temporary_skip_approved",
];

export const DEBT_SOURCE_QUALITIES: DebtSourceQuality[] = [
  "lender_confirmed",
  "user_entered",
  "estimated_default",
  "system_derived",
  "manual_confirmed",
];

export const CREDIT_CARD_MINIMUM_PAYMENT_MODES: CreditCardMinimumPaymentMode[] = [
  "Preset Rule",
  "Custom Rule",
  "Manual Minimum Amount",
];

export const CREDIT_CARD_PAYMENT_ASSUMPTION_MODES: CreditCardPaymentAssumptionMode[] = [
  "Minimum Due",
  "Statement Balance",
  "Total Balance",
  "Custom Amount",
];

export const CREDIT_CARD_CUSTOM_RULE_OPERATION_MODES: CreditCardCustomRuleOperationMode[] = [
  "Percent Only",
  "Flat Only",
  "Percent Plus Flat",
  "Greater Of Flat Or Percent",
  "Lesser Of Flat Or Percent",
];
