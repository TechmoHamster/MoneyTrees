import type {
  AdvisorConfidence,
  AdvisorContext,
  AdvisorDataQuality,
  AdvisorItem,
  AdvisorPreference,
  AdvisorRecommendationType,
  AdvisorScenarioResult,
  AdvisorStrategyMode,
  AdvisorTrackingEvent,
  AdvisorTrackingSummary,
  Bill,
  BillCategory,
  DashboardSummary,
  ReportingSnapshot,
} from "@/lib/types";
import type { AdvisorFacts, AdvisorProviderOutput } from "@/lib/advisor-contracts";
import {
  calculateSummary,
  formatCurrency,
  getBillLateFeeAmount,
  getBillTotalAmount,
  getTodayDateString,
  normalizeAmount,
} from "@/lib/utils";

type AdvisorInput = AdvisorFacts;

type BillMeta = {
  bill: Bill;
  totalAmount: number;
  lateFeeAmount: number;
  daysUntilDue: number | null;
  urgencyScore: number;
  balanceImpactPercent: number;
  obligationSharePercent: number;
  isPastDue: boolean;
  isUpcoming: boolean;
  isDueSoon: boolean;
  isImmediate: boolean;
  isEssential: boolean;
  isDiscretionary: boolean;
};

type ConfidenceProfile = {
  tier: AdvisorConfidence;
  maxItems: number;
  summaryLabel: string;
};

type Candidate = AdvisorItem & {
  focusBillId?: string;
  focusCategory?: BillCategory;
  signalStrength: number;
};

type InternalScenario = AdvisorScenarioResult & {
  fitScore: number;
  safetyScore: number;
  downsideScore: number;
};

type BillDecisionProfile = {
  meta: BillMeta;
  totalScore: number;
  urgencyComponent: number;
  overdueComponent: number;
  feeComponent: number;
  essentialComponent: number;
  cashComponent: number;
  concentrationComponent: number;
  strategyComponent: number;
  tieBreakerComponent: number;
};

type StrategicBillDecision = {
  chosen?: BillMeta;
  runnerUp?: BillMeta;
  chosenProfile?: BillDecisionProfile;
  runnerUpProfile?: BillDecisionProfile;
  outrankReason?: string;
  strategyInfluence?: string;
};

type ExposureHistory = {
  analysisRunCount: number;
  shownIdCounts: Map<string, number>;
  shownTypeCounts: Map<AdvisorRecommendationType, number>;
  shownBillCounts: Map<string, number>;
  shownCategoryCounts: Map<BillCategory, number>;
  shownScenarioCounts: Map<AdvisorScenarioResult["type"], number>;
  actionedSourceIds: Set<string>;
  repeatedExposureCount: number;
};

const CATEGORY_CONTEXT_BOOST: Record<
  AdvisorContext,
  Record<AdvisorItem["category"], number>
> = {
  overview: {
    "Priority Alert": 30,
    Recommendation: 22,
    "Preventive Guidance": 16,
    "Trend Commentary": 6,
  },
  planning: {
    "Priority Alert": 18,
    Recommendation: 28,
    "Preventive Guidance": 22,
    "Trend Commentary": 4,
  },
  reporting: {
    "Priority Alert": 4,
    Recommendation: 10,
    "Preventive Guidance": 8,
    "Trend Commentary": 30,
  },
  all: {
    "Priority Alert": 18,
    Recommendation: 22,
    "Preventive Guidance": 18,
    "Trend Commentary": 16,
  },
};

const TYPE_CONTEXT_BOOST: Record<
  AdvisorContext,
  Partial<Record<AdvisorRecommendationType, number>>
> = {
  overview: {
    "Priority Alert": 18,
    "Pay First": 16,
    "Watch Next": 8,
    "Prevent Fee Risk": 10,
    "Cash Preservation Move": 16,
    "Reduce Upcoming Pressure": 14,
    "Protect Essentials": 14,
    "Biggest Category Risk": 6,
    "Trend Warning": 8,
    "Improvement Signal": 4,
  },
  planning: {
    "Priority Alert": 10,
    "Pay First": 26,
    "Watch Next": 14,
    "Prevent Fee Risk": 26,
    "Cash Preservation Move": 12,
    "Reduce Upcoming Pressure": 18,
    "Protect Essentials": 18,
    "Biggest Category Risk": 8,
    "Trend Warning": 2,
    "Improvement Signal": 0,
  },
  reporting: {
    "Priority Alert": -10,
    "Pay First": -24,
    "Watch Next": -16,
    "Prevent Fee Risk": -4,
    "Cash Preservation Move": 4,
    "Reduce Upcoming Pressure": 4,
    "Protect Essentials": 2,
    "Biggest Category Risk": 18,
    "Trend Warning": 42,
    "Improvement Signal": 28,
  },
  all: {
    "Priority Alert": 10,
    "Pay First": 14,
    "Watch Next": 10,
    "Prevent Fee Risk": 16,
    "Cash Preservation Move": 12,
    "Reduce Upcoming Pressure": 14,
    "Protect Essentials": 12,
    "Biggest Category Risk": 10,
    "Trend Warning": 14,
    "Improvement Signal": 10,
  },
};

const STRATEGY_LABEL: Record<AdvisorStrategyMode, string> = {
  "reduce-overdue-count": "Reduce Overdue Count First",
  "minimize-late-fees": "Minimize Late Fees First",
  "protect-essentials": "Protect Essentials First",
  "preserve-cash-buffer": "Preserve Cash Buffer First",
  snowball: "Lowest Balance / Snowball",
  avalanche: "Highest Cost / Avalanche",
};

const ESSENTIAL_CATEGORIES = new Set<BillCategory>([
  "Debt",
  "Utilities",
  "Insurance",
  "Rent / Housing",
  "Groceries",
]);
const DISCRETIONARY_CATEGORIES = new Set<BillCategory>([
  "Subscription",
  "Services",
  "Other",
]);

function parseDateOnly(dateString: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = dateString.split("-");
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function getTodayDateOnly(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function getDaysUntilDue(dueDate: string): number | null {
  const due = parseDateOnly(dueDate);
  if (!due) {
    return null;
  }

  const today = getTodayDateOnly();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((due.getTime() - today.getTime()) / dayMs);
}

function formatPercent(value: number): string {
  const normalized = normalizeAmount(value);
  return normalized >= 10 ? `${normalized.toFixed(0)}%` : `${normalized.toFixed(1)}%`;
}

function sumAmounts(values: number[]): number {
  return normalizeAmount(values.reduce((sum, value) => sum + value, 0));
}

function incrementCount<T>(map: Map<T, number>, key: T): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function deriveStartingBalance(summary: DashboardSummary): number {
  return normalizeAmount(summary.balanceLeft + summary.totalBills);
}

function getObligationSharePercent(totalAmount: number, summary: DashboardSummary): number {
  if (summary.totalBills <= 0) {
    return 0;
  }

  return normalizeAmount((totalAmount / summary.totalBills) * 100);
}

function getBalanceImpactPercent(totalAmount: number, summary: DashboardSummary): number {
  const effectiveBalanceBase = normalizeAmount(summary.totalBills + Math.max(summary.balanceLeft, 0));
  if (effectiveBalanceBase <= 0) {
    return 0;
  }

  return normalizeAmount((totalAmount / effectiveBalanceBase) * 100);
}

function buildUrgencyScore(meta: Omit<BillMeta, "urgencyScore">, summary: DashboardSummary): number {
  let score = 0;

  if (meta.isPastDue) {
    score += 135;
    if (typeof meta.daysUntilDue === "number" && meta.daysUntilDue < 0) {
      score += Math.min(24, Math.abs(meta.daysUntilDue) * 3);
    }
  } else if (meta.isImmediate) {
    score += 72;
  } else if (meta.isDueSoon) {
    score += 42;
  }

  if (meta.lateFeeAmount > 0) {
    score += 26 + Math.min(26, meta.lateFeeAmount * 0.55);
  }

  if (summary.balanceLeft < 0) {
    score += 24;
  }

  if (summary.balanceLeft > 0 && meta.totalAmount > summary.balanceLeft) {
    score += 22;
  }

  if (meta.isEssential) {
    score += 10;
  }

  score += Math.min(34, meta.totalAmount * 0.05);
  score += Math.min(18, meta.balanceImpactPercent * 0.55);
  score += Math.min(18, meta.obligationSharePercent * 0.3);

  return normalizeAmount(score);
}

function buildBillMeta(bill: Bill, summary: DashboardSummary): BillMeta {
  const totalAmount = getBillTotalAmount(bill);
  const lateFeeAmount = getBillLateFeeAmount(bill);
  const daysUntilDue = getDaysUntilDue(bill.dueDate);
  const isPastDue = bill.status === "Past Due";
  const isUpcoming = bill.status === "Upcoming";
  const isImmediate = isUpcoming && daysUntilDue !== null && daysUntilDue <= 3;
  const isDueSoon = isUpcoming && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;
  const balanceImpactPercent = getBalanceImpactPercent(totalAmount, summary);
  const obligationSharePercent = getObligationSharePercent(totalAmount, summary);
  const isEssential = ESSENTIAL_CATEGORIES.has(bill.category);
  const isDiscretionary = DISCRETIONARY_CATEGORIES.has(bill.category);

  return {
    bill,
    totalAmount,
    lateFeeAmount,
    daysUntilDue,
    urgencyScore: 0,
    balanceImpactPercent,
    obligationSharePercent,
    isPastDue,
    isUpcoming,
    isDueSoon,
    isImmediate,
    isEssential,
    isDiscretionary,
  };
}

function withUrgency(meta: Omit<BillMeta, "urgencyScore">, summary: DashboardSummary): BillMeta {
  return {
    ...meta,
    urgencyScore: buildUrgencyScore(meta, summary),
  };
}

function createWhy(signals: string[]): string {
  return `Driven by ${signals.join(", ")}.`;
}

function buildDataQuality(
  bills: Bill[],
  unpaidMeta: BillMeta[],
  summary: DashboardSummary,
  reporting: ReportingSnapshot,
): AdvisorDataQuality {
  const issues: string[] = [];
  let score = 100;

  const paidBills = bills.filter((bill) => bill.status === "Paid");
  const paidWithDates = paidBills.filter((bill) => typeof bill.paidDate === "string" && bill.paidDate.trim().length > 0);
  const activeValidDates = unpaidMeta.filter((item) => item.daysUntilDue !== null).length;
  const nonZeroTrendBuckets = reporting.trend.filter((point) => point.billCount > 0).length;
  const otherCount = bills.filter((bill) => bill.category === "Other").length;
  const uniqueCategories = new Set(bills.map((bill) => bill.category)).size;

  if (bills.length < 4) {
    issues.push("History depth is still shallow.");
    score -= 26;
  }

  if (unpaidMeta.length > 0 && activeValidDates / unpaidMeta.length < 0.75) {
    issues.push("Some active bills have weak due-date coverage.");
    score -= 14;
  }

  if (paidBills.length >= 2 && paidWithDates.length / paidBills.length < 0.7) {
    issues.push("Some paid bills are missing Date Paid, so historical attribution is softer.");
    score -= 16;
  }

  if (paidBills.length < 2 && bills.length > 0) {
    issues.push("Payment history is thin, so outcome learning is limited.");
    score -= 12;
  }

  if (nonZeroTrendBuckets < (reporting.range === "day" ? 1 : 2)) {
    issues.push("Trend depth is thin in the selected reporting window.");
    score -= 18;
  }

  if (bills.length >= 3 && otherCount / bills.length >= 0.35) {
    issues.push("Category assignment leans heavily on Other, which weakens category guidance.");
    score -= 12;
  }

  if (summary.pastDueCount >= 2 && summary.totalLateFees === 0) {
    issues.push("Overdue bills have limited late-fee detail, so fee guidance stays conservative.");
    score -= 8;
  }

  if (uniqueCategories <= 1 && bills.length >= 3) {
    issues.push("Category diversity is narrow, so category-pressure guidance is less expressive.");
    score -= 8;
  }

  const normalizedScore = Math.max(18, Math.min(100, score));
  const level = normalizedScore >= 78 ? "Strong" : normalizedScore >= 52 ? "Moderate" : "Sparse";

  if (level === "Strong") {
    return {
      level,
      score: normalizedScore,
      summary: "History depth and attribution quality are strong enough for firmer advisor guidance.",
      issues,
    };
  }

  if (level === "Moderate") {
    return {
      level,
      score: normalizedScore,
      summary: `Guidance is grounded, but ${issues[0]?.toLowerCase() ?? "some signals are still incomplete"}`,
      issues,
    };
  }

  return {
    level,
    score: normalizedScore,
    summary: `Advice is intentionally lighter because ${issues[0]?.toLowerCase() ?? "the current data set is sparse"}`,
    issues,
  };
}

function createCandidateConfidence(
  signalStrength: number,
  score: number,
  profile: ConfidenceProfile,
): AdvisorConfidence {
  let tier: AdvisorConfidence = "Light";
  if (signalStrength >= 4 || score >= 135) {
    tier = "High";
  } else if (signalStrength >= 3 || score >= 88) {
    tier = "Medium";
  }

  if (profile.tier === "Light") {
    return signalStrength >= 5 && score >= 140 ? "Medium" : "Light";
  }

  if (profile.tier === "Medium" && tier === "High") {
    return "Medium";
  }

  return tier;
}

function getConfidenceProfile(
  context: AdvisorContext,
  dataQuality: AdvisorDataQuality,
): ConfidenceProfile {
  if (dataQuality.level === "Sparse") {
    return {
      tier: "Light",
      maxItems: context === "overview" ? 1 : 2,
      summaryLabel: dataQuality.summary,
    };
  }

  if (dataQuality.level === "Moderate") {
    return {
      tier: "Medium",
      maxItems: context === "overview" ? 2 : 3,
      summaryLabel: dataQuality.summary,
    };
  }

  return {
    tier: "High",
    maxItems: context === "overview" ? 3 : context === "reporting" ? 3 : 4,
    summaryLabel: dataQuality.summary,
  };
}

function withContextScore(candidate: Candidate, context: AdvisorContext): Candidate {
  const categoryBoost = CATEGORY_CONTEXT_BOOST[context][candidate.category];
  const typeBoost = TYPE_CONTEXT_BOOST[context][candidate.recommendationType] ?? 0;
  return {
    ...candidate,
    score: candidate.score + categoryBoost + typeBoost,
  };
}

function getCategoryPressureShare(
  summary: DashboardSummary,
  category: BillCategory,
): { share: number; count: number } {
  const entry = summary.categoryBreakdown.find((item) => item.category === category);
  if (!entry || summary.unpaidTotal <= 0) {
    return { share: 0, count: entry?.count ?? 0 };
  }

  return {
    share: normalizeAmount((entry.total / summary.unpaidTotal) * 100),
    count: entry.count,
  };
}

function buildBillDecisionProfile(
  meta: BillMeta,
  preference: AdvisorPreference,
  summary: DashboardSummary,
): BillDecisionProfile {
  const { share: categoryShare, count: categoryCount } = getCategoryPressureShare(
    summary,
    meta.bill.category,
  );
  const projectedBalanceAfterPayment = normalizeAmount(summary.balanceLeft - meta.totalAmount);
  const urgencyComponent = normalizeAmount(meta.urgencyScore * 0.52);
  const overdueComponent = meta.isPastDue
    ? normalizeAmount(
        46 +
          Math.min(30, Math.abs(meta.daysUntilDue ?? 0) * 3.5) +
          Math.max(0, 22 - meta.totalAmount * 0.04),
      )
    : 0;
  const feeComponent =
    meta.lateFeeAmount > 0
      ? normalizeAmount(
          20 + meta.lateFeeAmount * 1.55 + (meta.isPastDue ? 12 : 0) + (meta.isDueSoon ? 6 : 0),
        )
      : 0;
  const essentialComponent = normalizeAmount(
    (meta.isEssential ? 22 : meta.isDiscretionary ? -8 : 0) +
      (meta.isPastDue ? (meta.isEssential ? 14 : 4) : 0) +
      (meta.isDueSoon && meta.isEssential ? 10 : 0),
  );
  const cashComponent = normalizeAmount(
    (summary.balanceLeft < preference.minimumCashBuffer ? 26 : 0) +
      Math.max(0, 34 - meta.totalAmount * 0.07) +
      (projectedBalanceAfterPayment >= preference.minimumCashBuffer ? 12 : 0) -
      Math.max(0, meta.totalAmount - Math.max(summary.balanceLeft, 0)) * 0.08,
  );
  const concentrationComponent =
    categoryCount >= 2 && categoryShare >= 30
      ? normalizeAmount(categoryShare * 0.42 + categoryCount * 5)
      : 0;

  let strategyComponent = 0;
  let tieBreakerComponent = 0;

  switch (preference.strategy) {
    case "reduce-overdue-count":
      strategyComponent += overdueComponent * 1.08;
      if (meta.isPastDue) {
        strategyComponent += Math.max(0, 28 - meta.totalAmount * 0.05);
      }
      tieBreakerComponent += meta.isPastDue ? 14 : 0;
      tieBreakerComponent += meta.daysUntilDue !== null ? -meta.daysUntilDue * 0.3 : 0;
      tieBreakerComponent += Math.max(0, 14 - meta.totalAmount * 0.02);
      break;
    case "minimize-late-fees":
      strategyComponent += feeComponent * 1.12 + meta.lateFeeAmount * 0.8;
      if (meta.lateFeeAmount > 0 && meta.totalAmount > 0) {
        tieBreakerComponent += normalizeAmount((meta.lateFeeAmount / meta.totalAmount) * 100);
      }
      tieBreakerComponent += meta.isPastDue ? 10 : 0;
      break;
    case "protect-essentials":
      strategyComponent += essentialComponent * 1.3 + (meta.isEssential ? 18 : -14);
      tieBreakerComponent += meta.isEssential ? 16 : -10;
      tieBreakerComponent += meta.daysUntilDue !== null ? -meta.daysUntilDue * 0.28 : 0;
      break;
    case "preserve-cash-buffer":
      strategyComponent += cashComponent * 1.25;
      if (summary.balanceLeft < preference.minimumCashBuffer) {
        strategyComponent += Math.max(0, 16 - meta.totalAmount * 0.025);
      }
      tieBreakerComponent += projectedBalanceAfterPayment >= 0 ? 12 : -18;
      tieBreakerComponent += meta.totalAmount <= Math.max(summary.balanceLeft, 0) ? 10 : -8;
      break;
    case "snowball":
      strategyComponent += overdueComponent * 0.78 + Math.max(0, 42 - meta.totalAmount * 0.08);
      tieBreakerComponent += Math.max(0, 24 - meta.totalAmount * 0.04);
      tieBreakerComponent += meta.isPastDue ? 8 : 0;
      break;
    case "avalanche":
      strategyComponent +=
        feeComponent * 0.7 + normalizeAmount(meta.totalAmount * 0.16) + overdueComponent * 0.34;
      tieBreakerComponent += normalizeAmount(meta.totalAmount * 0.03 + meta.lateFeeAmount * 0.5);
      tieBreakerComponent += meta.isPastDue ? 8 : 0;
      break;
  }

  return {
    meta,
    urgencyComponent,
    overdueComponent,
    feeComponent,
    essentialComponent,
    cashComponent,
    concentrationComponent,
    strategyComponent: normalizeAmount(strategyComponent),
    tieBreakerComponent: normalizeAmount(tieBreakerComponent),
    totalScore: normalizeAmount(
      urgencyComponent +
        overdueComponent +
        feeComponent +
        essentialComponent +
        cashComponent +
        concentrationComponent +
        strategyComponent +
        tieBreakerComponent,
    ),
  };
}

function withStrategyScore(
  candidate: Candidate,
  preference: AdvisorPreference,
  summary: DashboardSummary,
  metaById: Map<string, BillMeta>,
): Candidate {
  let boost = 0;
  const focusBill = candidate.focusBillId ? metaById.get(candidate.focusBillId) : undefined;

  switch (preference.strategy) {
    case "reduce-overdue-count":
      if (candidate.recommendationType === "Priority Alert") {
        boost += 20;
      }
      if (candidate.recommendationType === "Pay First" && focusBill?.isPastDue) {
        boost += 24 + Math.max(0, 18 - focusBill.totalAmount * 0.04);
      }
      break;
    case "minimize-late-fees":
      if (candidate.recommendationType === "Prevent Fee Risk") {
        boost += 30;
      }
      if (focusBill && focusBill.lateFeeAmount > 0) {
        boost += 16 + focusBill.lateFeeAmount * 0.45;
      }
      break;
    case "protect-essentials":
      if (candidate.recommendationType === "Protect Essentials") {
        boost += 30;
      }
      if (focusBill?.isEssential) {
        boost += 20;
      }
      if (focusBill?.isDiscretionary) {
        boost -= 14;
      }
      break;
    case "preserve-cash-buffer":
      if (candidate.recommendationType === "Cash Preservation Move") {
        boost += 34;
      }
      if (summary.balanceLeft < preference.minimumCashBuffer) {
        boost += 12;
      }
      break;
    case "snowball":
      if (candidate.recommendationType === "Pay First" && focusBill) {
        boost += Math.max(0, 34 - focusBill.totalAmount * 0.08);
      }
      break;
    case "avalanche":
      if (candidate.recommendationType === "Pay First" && focusBill) {
        boost += focusBill.totalAmount * 0.08 + focusBill.lateFeeAmount * 0.6;
      }
      if (candidate.recommendationType === "Prevent Fee Risk") {
        boost += 14;
      }
      break;
  }

  return {
    ...candidate,
    score: normalizeAmount(candidate.score + boost),
  };
}

function buildCandidate(
  profile: ConfidenceProfile,
  input: Omit<Candidate, "confidence">,
): Candidate {
  return {
    ...input,
    confidence: createCandidateConfidence(input.signalStrength, input.score, profile),
  };
}

function pickBillWithHighestLateFee(bills: BillMeta[]): BillMeta | undefined {
  return [...bills].sort((left, right) => right.lateFeeAmount - left.lateFeeAmount)[0];
}

function compareBillDecisionProfiles(
  left: BillDecisionProfile,
  right: BillDecisionProfile,
  preference: AdvisorPreference,
): number {
  if (left.totalScore !== right.totalScore) {
    return right.totalScore - left.totalScore;
  }

  switch (preference.strategy) {
    case "reduce-overdue-count":
      if (left.meta.isPastDue !== right.meta.isPastDue) {
        return left.meta.isPastDue ? -1 : 1;
      }
      if (left.meta.totalAmount !== right.meta.totalAmount) {
        return left.meta.totalAmount - right.meta.totalAmount;
      }
      break;
    case "minimize-late-fees":
      if (left.meta.lateFeeAmount !== right.meta.lateFeeAmount) {
        return right.meta.lateFeeAmount - left.meta.lateFeeAmount;
      }
      break;
    case "protect-essentials":
      if (left.meta.isEssential !== right.meta.isEssential) {
        return left.meta.isEssential ? -1 : 1;
      }
      break;
    case "preserve-cash-buffer":
      if (left.meta.totalAmount !== right.meta.totalAmount) {
        return left.meta.totalAmount - right.meta.totalAmount;
      }
      break;
    case "snowball":
      if (left.meta.totalAmount !== right.meta.totalAmount) {
        return left.meta.totalAmount - right.meta.totalAmount;
      }
      break;
    case "avalanche":
      if (left.meta.totalAmount !== right.meta.totalAmount) {
        return right.meta.totalAmount - left.meta.totalAmount;
      }
      break;
  }

  if (left.meta.isPastDue !== right.meta.isPastDue) {
    return left.meta.isPastDue ? -1 : 1;
  }
  if ((left.meta.daysUntilDue ?? 999) !== (right.meta.daysUntilDue ?? 999)) {
    return (left.meta.daysUntilDue ?? 999) - (right.meta.daysUntilDue ?? 999);
  }
  if (left.meta.lateFeeAmount !== right.meta.lateFeeAmount) {
    return right.meta.lateFeeAmount - left.meta.lateFeeAmount;
  }
  return right.meta.urgencyScore - left.meta.urgencyScore;
}

function describeStrategyInfluence(
  preference: AdvisorPreference,
  chosen: BillDecisionProfile,
): string {
  switch (preference.strategy) {
    case "reduce-overdue-count":
      return chosen.meta.isPastDue
        ? "Strategy influence: overdue-count reduction favors bills that clear one overdue item with less cash."
        : "Strategy influence: the current mode leans toward moves that stop upcoming bills from becoming overdue.";
    case "minimize-late-fees":
      return chosen.meta.lateFeeAmount > 0
        ? "Strategy influence: applied late fees and repeat fee pressure were weighted more heavily here."
        : "Strategy influence: fee exposure was prioritized even where overdue pressure was similar.";
    case "protect-essentials":
      return "Strategy influence: essential-category stability outranked discretionary cleanup.";
    case "preserve-cash-buffer":
      return "Strategy influence: projected buffer preservation outranked raw obligation size.";
    case "snowball":
      return "Strategy influence: smaller practical wins were weighted ahead of larger balances.";
    case "avalanche":
      return "Strategy influence: higher total cost and fee exposure were weighted ahead of smaller balances.";
  }
}

function describeBillOutrankReason(
  preference: AdvisorPreference,
  chosen: BillDecisionProfile,
  runnerUp?: BillDecisionProfile,
): string | undefined {
  if (!runnerUp) {
    return undefined;
  }

  if (chosen.meta.isPastDue && !runnerUp.meta.isPastDue) {
    return `Ranks above ${runnerUp.meta.bill.name} because it is already overdue.`;
  }

  if (chosen.meta.isEssential && !runnerUp.meta.isEssential && preference.strategy === "protect-essentials") {
    return `Ranks above ${runnerUp.meta.bill.name} because the active strategy favors essential stability first.`;
  }

  if (chosen.meta.lateFeeAmount - runnerUp.meta.lateFeeAmount >= 10) {
    return `Ranks above ${runnerUp.meta.bill.name} because it carries materially higher applied fee pressure.`;
  }

  if (
    (preference.strategy === "snowball" || preference.strategy === "reduce-overdue-count") &&
    runnerUp.meta.totalAmount - chosen.meta.totalAmount >= 40
  ) {
    return `Ranks above ${runnerUp.meta.bill.name} because it clears pressure with less cash.`;
  }

  if (
    preference.strategy === "avalanche" &&
    chosen.meta.totalAmount - runnerUp.meta.totalAmount >= 75
  ) {
    return `Ranks above ${runnerUp.meta.bill.name} because it removes more obligation weight at once.`;
  }

  if (
    preference.strategy === "preserve-cash-buffer" &&
    chosen.meta.totalAmount < runnerUp.meta.totalAmount
  ) {
    return `Ranks above ${runnerUp.meta.bill.name} because it preserves more remaining cash buffer.`;
  }

  if (chosen.meta.bill.category === runnerUp.meta.bill.category) {
    return `Edges ahead of ${runnerUp.meta.bill.name} on due-date and pressure tie-breaks within the same category.`;
  }

  return `Edges ahead of ${runnerUp.meta.bill.name} on combined urgency, cost, and strategy-fit tie-breaks.`;
}

function pickStrategicBill(
  unpaidMeta: BillMeta[],
  preference: AdvisorPreference,
  summary: DashboardSummary,
): StrategicBillDecision {
  if (unpaidMeta.length === 0) {
    return {};
  }

  const sortedProfiles = unpaidMeta
    .map((meta) => buildBillDecisionProfile(meta, preference, summary))
    .sort((left, right) => compareBillDecisionProfiles(left, right, preference));

  const chosenProfile = sortedProfiles[0];
  const runnerUpProfile = sortedProfiles[1];

  return {
    chosen: chosenProfile?.meta,
    runnerUp: runnerUpProfile?.meta,
    chosenProfile,
    runnerUpProfile,
    outrankReason:
      chosenProfile && runnerUpProfile
        ? describeBillOutrankReason(preference, chosenProfile, runnerUpProfile)
        : undefined,
    strategyInfluence: chosenProfile
      ? describeStrategyInfluence(preference, chosenProfile)
      : undefined,
  };
}

function getPayFirstTitle(strategy: AdvisorStrategyMode, billName: string): string {
  switch (strategy) {
    case "reduce-overdue-count":
      return `Clear ${billName} to cut overdue count first`;
    case "minimize-late-fees":
      return `Use ${billName} to reduce fee drag first`;
    case "protect-essentials":
      return `Stabilize ${billName} before discretionary bills`;
    case "preserve-cash-buffer":
      return `Use ${billName} to protect your cash buffer`;
    case "snowball":
      return `Use ${billName} as the next snowball win`;
    case "avalanche":
      return `Attack ${billName} to cut the highest cost pressure`;
  }
}

function getPayFirstRecommendation(strategy: AdvisorStrategyMode, bill: BillMeta): string {
  switch (strategy) {
    case "reduce-overdue-count":
      return `${bill.bill.name} is the cleanest move for reducing the overdue queue one bill at a time.`;
    case "minimize-late-fees":
      return `${bill.bill.name} is the strongest fee-reduction move in the current bill set.`;
    case "protect-essentials":
      return `${bill.bill.name} sits in an essential category and should stay ahead of non-essential pressure.`;
    case "preserve-cash-buffer":
      return `${bill.bill.name} helps stabilize near-term pressure without letting the remaining buffer deteriorate further.`;
    case "snowball":
      return `${bill.bill.name} is a smaller practical win that can build momentum while reducing active pressure.`;
    case "avalanche":
      return `${bill.bill.name} carries one of the strongest combined cost and fee signals in the current queue.`;
  }
}

function buildExposureHistory(tracking: AdvisorTrackingEvent[]): ExposureHistory {
  const analysisRuns = [...tracking]
    .filter((event) => event.type === "analysis-run")
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 6);
  const followEvents = [...tracking]
    .filter((event) => event.type !== "analysis-run")
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 12);

  const shownIdCounts = new Map<string, number>();
  const shownTypeCounts = new Map<AdvisorRecommendationType, number>();
  const shownBillCounts = new Map<string, number>();
  const shownCategoryCounts = new Map<BillCategory, number>();
  const shownScenarioCounts = new Map<AdvisorScenarioResult["type"], number>();

  for (const run of analysisRuns) {
    run.shownRecommendationIds?.forEach((id) => incrementCount(shownIdCounts, id));
    run.shownRecommendationTypes?.forEach((type) => incrementCount(shownTypeCounts, type));
    run.shownFocusBillIds?.forEach((id) => incrementCount(shownBillCounts, id));
    run.shownFocusCategories?.forEach((category) => incrementCount(shownCategoryCounts, category));
    run.shownScenarioTypes?.forEach((type) => incrementCount(shownScenarioCounts, type));
  }

  const repeatedExposureCount = [...shownIdCounts.values()].reduce(
    (sum, count) => sum + Math.max(0, count - 1),
    0,
  );

  return {
    analysisRunCount: analysisRuns.length,
    shownIdCounts,
    shownTypeCounts,
    shownBillCounts,
    shownCategoryCounts,
    shownScenarioCounts,
    actionedSourceIds: new Set(
      followEvents
        .map((event) => event.sourceId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
    repeatedExposureCount,
  };
}

function buildTrackingSummary(
  tracking: AdvisorTrackingEvent[],
  summary: DashboardSummary,
  preference: AdvisorPreference,
  exposureHistory: ExposureHistory,
): AdvisorTrackingSummary {
  const sorted = [...tracking].sort((left, right) => right.timestamp - left.timestamp);
  const followed = sorted.filter((event) => event.type !== "analysis-run");
  const analysisRunsForStrategy = sorted.filter(
    (event) => event.type === "analysis-run" && event.strategy === preference.strategy,
  );

  let note: string | undefined;
  const latestFollowed = followed[0];
  if (latestFollowed) {
    const overdueImprovement = latestFollowed.snapshot.pastDueCount - summary.pastDueCount;
    const lateFeeImprovement = normalizeAmount(
      latestFollowed.snapshot.totalLateFees - summary.totalLateFees,
    );
    const balanceImprovement = normalizeAmount(summary.balanceLeft - latestFollowed.snapshot.balanceLeft);

    if (overdueImprovement > 0) {
      note = `Past-due count is down ${overdueImprovement} since the last advisor-led action.`;
    } else if (lateFeeImprovement > 0) {
      note = `Late-fee pressure is down ${formatCurrency(lateFeeImprovement)} since the last advisor-led action.`;
    } else if (balanceImprovement > 0) {
      note = `Balance left improved by ${formatCurrency(balanceImprovement)} after the last advisor-led action.`;
    }
  }

  if (!note && analysisRunsForStrategy.length > 0) {
    const previousRun = analysisRunsForStrategy[0];
    const overdueImprovement = previousRun.snapshot.pastDueCount - summary.pastDueCount;
    const negativeImprovement = normalizeAmount(
      previousRun.snapshot.negativeAmount - summary.negativeAmount,
    );

    if (overdueImprovement > 0) {
      note = `${STRATEGY_LABEL[preference.strategy]} has reduced overdue count since the last analyzed snapshot.`;
    } else if (negativeImprovement > 0) {
      note = `${STRATEGY_LABEL[preference.strategy]} is preserving more balance than the last analyzed snapshot.`;
    }
  }

  if (!note && exposureHistory.analysisRunCount >= 2 && exposureHistory.repeatedExposureCount >= 3) {
    note = "Recent advisor runs have repeated similar guidance, which usually means the same pressure pocket is still unresolved.";
  }

  return {
    followedCount: followed.length,
    lastFollowedAt: latestFollowed?.timestamp,
    analysisRunCount: exposureHistory.analysisRunCount,
    recentRepeatExposureCount: exposureHistory.repeatedExposureCount,
    note,
  };
}

function getCandidateExposurePenalty(
  candidate: Candidate,
  exposureHistory: ExposureHistory,
): number {
  if (candidate.priority === "Critical" || candidate.signalStrength >= 5) {
    return 0;
  }

  let penalty = 0;
  penalty += Math.max(0, (exposureHistory.shownIdCounts.get(candidate.id) ?? 0) - 1) * 8;
  penalty +=
    Math.max(0, (exposureHistory.shownTypeCounts.get(candidate.recommendationType) ?? 0) - 1) * 4;
  if (candidate.focusBillId) {
    penalty += Math.max(0, (exposureHistory.shownBillCounts.get(candidate.focusBillId) ?? 0) - 1) * 10;
  }
  if (candidate.focusCategory) {
    penalty +=
      Math.max(0, (exposureHistory.shownCategoryCounts.get(candidate.focusCategory) ?? 0) - 1) * 5;
  }

  if (exposureHistory.actionedSourceIds.has(candidate.id)) {
    penalty = Math.max(0, penalty - 6);
  }

  return penalty;
}

function selectCandidates(
  candidates: Candidate[],
  maxItems: number,
  exposureHistory: ExposureHistory,
): AdvisorItem[] {
  const sorted = [...candidates]
    .map((candidate) => ({
      candidate,
      effectiveScore: normalizeAmount(
        candidate.score - getCandidateExposurePenalty(candidate, exposureHistory),
      ),
    }))
    .sort((left, right) => {
      if (left.effectiveScore !== right.effectiveScore) {
        return right.effectiveScore - left.effectiveScore;
      }
      return right.candidate.signalStrength - left.candidate.signalStrength;
    })
    .map((entry) => entry.candidate);
  const selected: Candidate[] = [];
  const selectedIds = new Set<string>();
  const usedBills = new Set<string>();
  const usedCategories = new Set<string>();
  const usedTypes = new Set<string>();

  const canAddInDiversityPass = (candidate: Candidate): boolean => {
    if (selectedIds.has(candidate.id)) {
      return false;
    }

    if (
      candidate.focusBillId &&
      usedBills.has(candidate.focusBillId) &&
      candidate.priority !== "Critical"
    ) {
      return false;
    }

    if (usedTypes.has(candidate.recommendationType) && candidate.priority !== "Critical") {
      return false;
    }

    if (
      candidate.focusCategory &&
      usedCategories.has(candidate.focusCategory) &&
      candidate.priority === "Medium"
    ) {
      return false;
    }

    return true;
  };

  const canAddInFillPass = (candidate: Candidate): boolean => {
    if (selectedIds.has(candidate.id)) {
      return false;
    }

    if (
      candidate.focusBillId &&
      usedBills.has(candidate.focusBillId) &&
      candidate.priority !== "Critical"
    ) {
      return false;
    }

    return true;
  };

  const addCandidate = (candidate: Candidate) => {
    selected.push(candidate);
    selectedIds.add(candidate.id);
    if (candidate.focusBillId) {
      usedBills.add(candidate.focusBillId);
    }
    if (candidate.focusCategory) {
      usedCategories.add(candidate.focusCategory);
    }
    usedTypes.add(candidate.recommendationType);
  };

  for (const candidate of sorted) {
    if (selected.length >= maxItems) {
      break;
    }

    if (canAddInDiversityPass(candidate)) {
      addCandidate(candidate);
    }
  }

  for (const candidate of sorted) {
    if (selected.length >= maxItems) {
      break;
    }

    if (canAddInFillPass(candidate)) {
      addCandidate(candidate);
    }
  }

  return selected.map((candidate) => {
    const { signalStrength, ...nextCandidate } = candidate;
    void signalStrength;
    return nextCandidate;
  });
}

function markBillsPaid(bills: Bill[], billIds: string[]): Bill[] {
  const idSet = new Set(billIds);
  const paidDate = getTodayDateString();

  return bills.map((bill) => {
    if (!idSet.has(bill.id) || bill.status === "Paid") {
      return bill;
    }

    return {
      ...bill,
      status: "Paid",
      paidDate: bill.paidDate ?? paidDate,
      paidAmount:
        typeof bill.paidAmount === "number" && Number.isFinite(bill.paidAmount)
          ? bill.paidAmount
          : getBillTotalAmount(bill),
    };
  });
}

function ageUpcomingBillsByDays(bills: Bill[], days: number): Bill[] {
  const today = getTodayDateOnly();
  const boundary = addDays(today, days);

  return bills.map((bill) => {
    if (bill.status !== "Upcoming") {
      return bill;
    }

    const dueDate = parseDateOnly(bill.dueDate);
    if (!dueDate) {
      return bill;
    }

    if (dueDate >= today && dueDate <= boundary) {
      return {
        ...bill,
        status: "Past Due",
      };
    }

    return bill;
  });
}

function summarizeScenario(
  title: string,
  baselineSummary: DashboardSummary,
  projectedSummary: DashboardSummary,
): string {
  const notes: string[] = [];

  const pastDueReduction = baselineSummary.pastDueCount - projectedSummary.pastDueCount;
  const lateFeeReduction = normalizeAmount(
    baselineSummary.totalLateFees - projectedSummary.totalLateFees,
  );
  const balanceLift = normalizeAmount(projectedSummary.balanceLeft - baselineSummary.balanceLeft);

  if (pastDueReduction > 0) {
    notes.push(`past due ${pastDueReduction} lower`);
  } else if (projectedSummary.pastDueCount > baselineSummary.pastDueCount) {
    notes.push(`past due ${projectedSummary.pastDueCount - baselineSummary.pastDueCount} higher`);
  }

  if (lateFeeReduction > 0) {
    notes.push(`late fees ${formatCurrency(lateFeeReduction)} lower`);
  }

  if (balanceLift > 0) {
    notes.push(`balance left ${formatCurrency(balanceLift)} higher`);
  }

  if (notes.length === 0) {
    return `${title} keeps the current pressure profile mostly unchanged.`;
  }

  return `${title} would leave ${notes.join(", ")}.`;
}

function summarizeScenarioTradeoff(
  baselineSummary: DashboardSummary,
  projectedSummary: DashboardSummary,
): string | undefined {
  const notes: string[] = [];
  const balanceDelta = normalizeAmount(projectedSummary.balanceLeft - baselineSummary.balanceLeft);
  const pastDueDelta = projectedSummary.pastDueCount - baselineSummary.pastDueCount;
  const lateFeeDelta = normalizeAmount(projectedSummary.totalLateFees - baselineSummary.totalLateFees);
  const negativeDelta = normalizeAmount(
    projectedSummary.negativeAmount - baselineSummary.negativeAmount,
  );
  const unpaidDelta = normalizeAmount(projectedSummary.unpaidTotal - baselineSummary.unpaidTotal);
  const activeBillDelta = projectedSummary.activeBillCount - baselineSummary.activeBillCount;

  if (pastDueDelta < 0 && balanceDelta < 0) {
    notes.push(
      `Cuts overdue count but uses ${formatCurrency(Math.abs(balanceDelta))} more cash now`,
    );
  } else if (balanceDelta > 0 && pastDueDelta > 0) {
    notes.push(
      `Keeps ${formatCurrency(balanceDelta)} more balance left but leaves ${pastDueDelta} more bill${pastDueDelta === 1 ? "" : "s"} past due`,
    );
  }

  if (lateFeeDelta > 0) {
    notes.push(`leaves ${formatCurrency(lateFeeDelta)} more in active late fees`);
  } else if (lateFeeDelta < 0 && pastDueDelta >= 0) {
    notes.push(`reduces fee drag without fully clearing overdue pressure`);
  }

  if (pastDueDelta < 0 && lateFeeDelta === 0) {
    notes.push("reduces overdue count first, but leaves current fee pressure mostly unchanged");
  } else if (lateFeeDelta < 0 && pastDueDelta === 0) {
    notes.push("reduces fee drag first, but leaves the overdue queue largely unchanged");
  }

  if (pastDueDelta === 0 && unpaidDelta < 0 && activeBillDelta < 0) {
    notes.push("reduces total active pressure without materially changing overdue status");
  }

  if (negativeDelta > 0) {
    notes.push(`worsens negative amount by ${formatCurrency(negativeDelta)}`);
  }

  if (notes.length === 0) {
    if (projectedSummary.pastDueCount > 0) {
      notes.push(
        `still leaves ${projectedSummary.pastDueCount} bill${projectedSummary.pastDueCount === 1 ? "" : "s"} past due`,
      );
    } else if (projectedSummary.totalLateFees > 0) {
      notes.push(
        `still leaves ${formatCurrency(projectedSummary.totalLateFees)} in active late-fee pressure`,
      );
    } else if (projectedSummary.activeBillCount > 0) {
      notes.push(
        `still leaves ${projectedSummary.activeBillCount} active bill${projectedSummary.activeBillCount === 1 ? "" : "s"} to manage`,
      );
    }
  }

  if (notes.length === 0) {
    return undefined;
  }

  return `Tradeoff: ${notes.join("; ")}.`;
}

function describeCategoryPressure(
  baselineSummary: DashboardSummary,
  projectedSummary: DashboardSummary,
): string | undefined {
  const baselineTop = baselineSummary.categoryBreakdown[0];
  const projectedTop = projectedSummary.categoryBreakdown[0];
  if (!baselineTop || !projectedTop) {
    return undefined;
  }

  const baselineShare =
    baselineSummary.unpaidTotal > 0
      ? normalizeAmount((baselineTop.total / baselineSummary.unpaidTotal) * 100)
      : 0;
  const projectedShare =
    projectedSummary.unpaidTotal > 0
      ? normalizeAmount((projectedTop.total / projectedSummary.unpaidTotal) * 100)
      : 0;

  if (baselineTop.category === projectedTop.category) {
    if (Math.abs(projectedShare - baselineShare) < 8) {
      return undefined;
    }

    return `${baselineTop.category} pressure shifts from ${formatPercent(baselineShare)} to ${formatPercent(projectedShare)} of unpaid obligations.`;
  }

  return `Top category pressure would shift from ${baselineTop.category} to ${projectedTop.category}.`;
}

function createScenario(
  input: {
    id: string;
    type: AdvisorScenarioResult["type"];
    title: string;
    description: string;
    simulatedBills: Bill[];
    baselineSummary: DashboardSummary;
    includePaidInTotals: boolean;
    signals: string[];
    action?: AdvisorScenarioResult["action"];
    actionLabel?: string;
    riskNote?: string;
  },
): InternalScenario {
  const projectedSummary = calculateSummary(
    input.simulatedBills,
    deriveStartingBalance(input.baselineSummary),
    input.includePaidInTotals,
  );

  return {
    id: input.id,
    type: input.type,
    priority: "Useful",
    title: input.title,
    description: input.description,
    effectSummary: summarizeScenario(input.title, input.baselineSummary, projectedSummary),
    projectedBalanceLeft: projectedSummary.balanceLeft,
    projectedNegativeAmount: projectedSummary.negativeAmount,
    projectedPastDueCount: projectedSummary.pastDueCount,
    projectedUnpaidTotal: projectedSummary.unpaidTotal,
    projectedActiveBillCount: projectedSummary.activeBillCount,
    projectedLateFeeTotal: projectedSummary.totalLateFees,
    balanceLeftDelta: normalizeAmount(projectedSummary.balanceLeft - input.baselineSummary.balanceLeft),
    negativeAmountDelta: normalizeAmount(projectedSummary.negativeAmount - input.baselineSummary.negativeAmount),
    pastDueCountDelta: projectedSummary.pastDueCount - input.baselineSummary.pastDueCount,
    unpaidTotalDelta: normalizeAmount(projectedSummary.unpaidTotal - input.baselineSummary.unpaidTotal),
    activeBillCountDelta: projectedSummary.activeBillCount - input.baselineSummary.activeBillCount,
    lateFeeTotalDelta: normalizeAmount(projectedSummary.totalLateFees - input.baselineSummary.totalLateFees),
    categoryPressureNote: describeCategoryPressure(input.baselineSummary, projectedSummary),
    riskNote: input.riskNote,
    tradeoffSummary: summarizeScenarioTradeoff(input.baselineSummary, projectedSummary),
    signals: input.signals,
    action: input.action,
    actionLabel: input.actionLabel,
    fitScore: 0,
    safetyScore: 0,
    downsideScore: 0,
  };
}

function scoreScenario(
  scenario: InternalScenario,
  preference: AdvisorPreference,
  summary: DashboardSummary,
): { fitScore: number; safetyScore: number; downsideScore: number } {
  const pastDueImprovement = summary.pastDueCount - scenario.projectedPastDueCount;
  const lateFeeImprovement = normalizeAmount(summary.totalLateFees - scenario.projectedLateFeeTotal);
  const balanceImprovement = normalizeAmount(scenario.projectedBalanceLeft - summary.balanceLeft);
  const unpaidImprovement = normalizeAmount(summary.unpaidTotal - scenario.projectedUnpaidTotal);
  const negativeImprovement = normalizeAmount(summary.negativeAmount - scenario.projectedNegativeAmount);

  let score =
    pastDueImprovement * 38 +
    lateFeeImprovement * 0.95 +
    balanceImprovement * 0.18 +
    unpaidImprovement * 0.06 +
    negativeImprovement * 0.25;

  if (scenario.type === "wait-7-days") {
    score -= 24;
  }

  switch (preference.strategy) {
    case "reduce-overdue-count":
      score += pastDueImprovement * 52;
      if (scenario.type === "clear-all-past-due") {
        score += 30;
      }
      if (scenario.type === "pay-smallest-overdue-first") {
        score += 24;
      }
      break;
    case "minimize-late-fees":
      score += lateFeeImprovement * 1.8;
      if (scenario.type === "pay-fee-bills-first") {
        score += 34;
      }
      break;
    case "protect-essentials":
      if (scenario.type === "pay-essentials-first") {
        score += 34;
      }
      if (scenario.type === "focus-top-category") {
        score += 16;
      }
      break;
    case "preserve-cash-buffer":
      score += balanceImprovement * 0.36;
      score -= Math.max(0, preference.minimumCashBuffer - scenario.projectedBalanceLeft) * 0.18;
      break;
    case "snowball":
      if (scenario.type === "pay-smallest-overdue-first") {
        score += 44;
      }
      break;
    case "avalanche":
      if (scenario.type === "pay-largest-overdue-first") {
        score += 44;
      }
      if (scenario.type === "pay-fee-bills-first") {
        score += 16;
      }
      break;
  }

  const safetyScore = normalizeAmount(
    Math.max(0, scenario.projectedBalanceLeft) * 0.22 +
      negativeImprovement * 0.42 +
      Math.max(0, preference.minimumCashBuffer - Math.max(0, scenario.projectedBalanceLeft)) * -0.16 +
      lateFeeImprovement * 0.28 -
      scenario.projectedPastDueCount * 10,
  );
  const downsideScore = normalizeAmount(
    Math.max(0, scenario.projectedPastDueCount - summary.pastDueCount) * 18 +
      Math.max(0, scenario.projectedNegativeAmount - summary.negativeAmount) * 0.22 +
      Math.max(0, scenario.projectedLateFeeTotal - summary.totalLateFees) * 0.55,
  );

  return {
    fitScore: normalizeAmount(score),
    safetyScore,
    downsideScore,
  };
}

function describeScenarioStrategyInfluence(
  scenario: InternalScenario,
  preference: AdvisorPreference,
): string | undefined {
  switch (preference.strategy) {
    case "reduce-overdue-count":
      if (
        scenario.type === "clear-all-past-due" ||
        scenario.type === "pay-smallest-overdue-first"
      ) {
        return "Strategy influence: overdue-count reduction boosts scenarios that clear the queue quickly.";
      }
      break;
    case "minimize-late-fees":
      if (scenario.type === "pay-fee-bills-first" || scenario.projectedLateFeeTotal < 0) {
        return "Strategy influence: late-fee reduction boosts scenarios that remove active fee pressure earliest.";
      }
      break;
    case "protect-essentials":
      if (scenario.type === "pay-essentials-first" || scenario.type === "focus-top-category") {
        return "Strategy influence: essential stability boosts scenarios that protect critical categories first.";
      }
      break;
    case "preserve-cash-buffer":
      if (scenario.projectedBalanceLeft >= preference.minimumCashBuffer) {
        return "Strategy influence: cash-buffer protection boosts scenarios that leave more balance after action.";
      }
      break;
    case "snowball":
      if (scenario.type === "pay-smallest-overdue-first") {
        return "Strategy influence: the snowball mode boosts smaller practical wins first.";
      }
      break;
    case "avalanche":
      if (
        scenario.type === "pay-largest-overdue-first" ||
        scenario.type === "pay-fee-bills-first"
      ) {
        return "Strategy influence: the avalanche mode boosts larger balances and fee-heavy scenarios.";
      }
      break;
  }

  return undefined;
}

function describeScenarioRankingReason(
  scenario: InternalScenario,
  bestFit?: InternalScenario,
  safest?: InternalScenario,
): string | undefined {
  if (bestFit && scenario.id === bestFit.id) {
    return "Ranks first because it delivers the strongest combined improvement across overdue pressure, fees, and balance stability.";
  }

  if (safest && scenario.id === safest.id) {
    return "Ranks as the safest option because it protects more remaining balance even if it leaves some pressure unresolved.";
  }

  if (scenario.type === "wait-7-days") {
    return "Included as a defensive comparison so the cost of waiting stays explicit.";
  }

  if (scenario.downsideScore > 0) {
    return "Included because it solves one pressure pocket, but with a clearer tradeoff than the higher-ranked options.";
  }

  return "Included as a useful alternative with a narrower improvement profile than the higher-ranked option.";
}

function getScenarioExposurePenalty(
  scenario: InternalScenario,
  exposureHistory: ExposureHistory,
): number {
  return Math.max(0, (exposureHistory.shownScenarioCounts.get(scenario.type) ?? 0) - 1) * 5;
}

function buildScenarios(
  bills: Bill[],
  unpaidMeta: BillMeta[],
  summary: DashboardSummary,
  includePaidInTotals: boolean,
  preference: AdvisorPreference,
  dataQuality: AdvisorDataQuality,
  exposureHistory: ExposureHistory,
): AdvisorScenarioResult[] {
  const overdueBills = unpaidMeta.filter((item) => item.isPastDue);
  const feeBearingBills = unpaidMeta.filter((item) => item.lateFeeAmount > 0);
  const essentialBills = unpaidMeta.filter((item) => item.isEssential);
  const strategicBill = pickStrategicBill(unpaidMeta, preference, summary);
  const smallestOverdue = [...overdueBills].sort((left, right) => left.totalAmount - right.totalAmount)[0];
  const largestOverdue = [...overdueBills].sort((left, right) => right.totalAmount - left.totalAmount)[0];
  const topUnpaidCategory = summary.categoryBreakdown[0];

  const scenarios: InternalScenario[] = [];

  if (strategicBill.chosen) {
    scenarios.push(
      createScenario({
        id: `scenario-strategy-${strategicBill.chosen.bill.id}`,
        type: "pay-strategy-bill-first",
        title: `Pay ${strategicBill.chosen.bill.name} first`,
        description: `Simulate resolving the current best-fit bill under ${STRATEGY_LABEL[preference.strategy]}.`,
        simulatedBills: markBillsPaid(bills, [strategicBill.chosen.bill.id]),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${formatCurrency(strategicBill.chosen.totalAmount)} total obligation`,
          strategicBill.chosen.isPastDue
            ? "currently past due"
            : `due in ${Math.max(0, strategicBill.chosen.daysUntilDue ?? 0)} day${(strategicBill.chosen.daysUntilDue ?? 0) === 1 ? "" : "s"}`,
          strategicBill.chosen.lateFeeAmount > 0
            ? `${formatCurrency(strategicBill.chosen.lateFeeAmount)} in applied late fees`
            : "no applied late fee currently",
        ],
        action: { type: "searchBill", query: strategicBill.chosen.bill.name },
        actionLabel: `Open ${strategicBill.chosen.bill.name}`,
      }),
    );
  }

  if (smallestOverdue) {
    scenarios.push(
      createScenario({
        id: `scenario-smallest-overdue-${smallestOverdue.bill.id}`,
        type: "pay-smallest-overdue-first",
        title: `Pay the smallest overdue bill first`,
        description: `Simulate clearing ${smallestOverdue.bill.name} as the smallest overdue balance.`,
        simulatedBills: markBillsPaid(bills, [smallestOverdue.bill.id]),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${smallestOverdue.bill.name} at ${formatCurrency(smallestOverdue.totalAmount)}`,
          `${summary.pastDueCount} current past-due bill${summary.pastDueCount === 1 ? "" : "s"}`,
        ],
        action: { type: "searchBill", query: smallestOverdue.bill.name },
        actionLabel: `Open ${smallestOverdue.bill.name}`,
      }),
    );
  }

  if (largestOverdue) {
    scenarios.push(
      createScenario({
        id: `scenario-largest-overdue-${largestOverdue.bill.id}`,
        type: "pay-largest-overdue-first",
        title: `Pay the largest overdue bill first`,
        description: `Simulate resolving ${largestOverdue.bill.name} as the highest-cost overdue bill.`,
        simulatedBills: markBillsPaid(bills, [largestOverdue.bill.id]),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${largestOverdue.bill.name} at ${formatCurrency(largestOverdue.totalAmount)}`,
          largestOverdue.lateFeeAmount > 0
            ? `${formatCurrency(largestOverdue.lateFeeAmount)} applied late fee`
            : "largest overdue cost center",
        ],
        action: { type: "searchBill", query: largestOverdue.bill.name },
        actionLabel: `Open ${largestOverdue.bill.name}`,
      }),
    );
  }

  if (overdueBills.length > 1) {
    scenarios.push(
      createScenario({
        id: "scenario-clear-all-past-due",
        type: "clear-all-past-due",
        title: "Clear all past-due bills",
        description: "Simulate resolving every currently past-due bill without touching the live ledger.",
        simulatedBills: markBillsPaid(
          bills,
          overdueBills.map((item) => item.bill.id),
        ),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${overdueBills.length} past-due bill${overdueBills.length === 1 ? "" : "s"}`,
          `${formatCurrency(sumAmounts(overdueBills.map((item) => item.totalAmount)))} overdue total`,
        ],
        action: { type: "filterPastDue" },
        actionLabel: "Review Past Due Bills",
      }),
    );
  }

  if (feeBearingBills.length > 0) {
    const focusFeeCategory = [...feeBearingBills]
      .sort((left, right) => right.lateFeeAmount - left.lateFeeAmount)[0]?.bill.category;

    scenarios.push(
      createScenario({
        id: "scenario-pay-fee-bills-first",
        type: "pay-fee-bills-first",
        title: "Pay all bills with late fees first",
        description: "Simulate removing every bill that currently carries an applied late fee.",
        simulatedBills: markBillsPaid(
          bills,
          feeBearingBills.map((item) => item.bill.id),
        ),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${feeBearingBills.length} fee-bearing bill${feeBearingBills.length === 1 ? "" : "s"}`,
          `${formatCurrency(sumAmounts(feeBearingBills.map((item) => item.lateFeeAmount)))} current applied late fees`,
        ],
        action: focusFeeCategory
          ? { type: "filterCategory", category: focusFeeCategory }
          : { type: "goToBills" },
        actionLabel: focusFeeCategory ? `Focus ${focusFeeCategory}` : "Open Bills",
      }),
    );
  }

  if (essentialBills.length > 0) {
    scenarios.push(
      createScenario({
        id: "scenario-pay-essentials-first",
        type: "pay-essentials-first",
        title: "Pay essentials first",
        description: "Simulate resolving essential categories before discretionary bills.",
        simulatedBills: markBillsPaid(
          bills,
          essentialBills.map((item) => item.bill.id),
        ),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${essentialBills.length} essential bill${essentialBills.length === 1 ? "" : "s"}`,
          `${formatCurrency(sumAmounts(essentialBills.map((item) => item.totalAmount)))} in essential pressure`,
        ],
        action: { type: "goToBills" },
        actionLabel: "Open Bills",
      }),
    );
  }

  if (topUnpaidCategory && topUnpaidCategory.count >= 2) {
    const categoryBills = unpaidMeta.filter((item) => item.bill.category === topUnpaidCategory.category);
    scenarios.push(
      createScenario({
        id: `scenario-focus-category-${topUnpaidCategory.category}`,
        type: "focus-top-category",
        title: `Focus ${topUnpaidCategory.category} first`,
        description: `Simulate resolving the current top unpaid category before spreading cash across smaller categories.`,
        simulatedBills: markBillsPaid(
          bills,
          categoryBills.map((item) => item.bill.id),
        ),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${formatCurrency(topUnpaidCategory.total)} in ${topUnpaidCategory.category}`,
          `${topUnpaidCategory.count} active bill${topUnpaidCategory.count === 1 ? "" : "s"}`,
        ],
        action: { type: "filterCategory", category: topUnpaidCategory.category },
        actionLabel: `Focus ${topUnpaidCategory.category}`,
      }),
    );
  }

  if (summary.dueIn7DaysCount > 0) {
    scenarios.push(
      createScenario({
        id: "scenario-wait-7-days",
        type: "wait-7-days",
        title: "Wait until the next 7 days",
        description: "Simulate taking no payment action across the next 7 days.",
        simulatedBills: ageUpcomingBillsByDays(bills, 7),
        baselineSummary: summary,
        includePaidInTotals,
        signals: [
          `${summary.dueIn7DaysCount} bill${summary.dueIn7DaysCount === 1 ? "" : "s"} due in 7 days`,
          `${formatCurrency(summary.dueIn7DaysTotal)} due soon`,
        ],
        action: { type: "filterDueSoon" },
        actionLabel: "Review Due Soon Bills",
        riskNote: "Future late fees are not projected automatically; only currently applied late fees are reflected.",
      }),
    );
  }

  const scored = scenarios
    .map((scenario) => {
      const metrics = scoreScenario(scenario, preference, summary);
      return {
        ...scenario,
        ...metrics,
        fitScore: normalizeAmount(metrics.fitScore - getScenarioExposurePenalty(scenario, exposureHistory)),
      };
    })
    .sort((left, right) => {
      if (left.fitScore !== right.fitScore) {
        return right.fitScore - left.fitScore;
      }
      return right.safetyScore - left.safetyScore;
    });

  const bestFit = scored[0];
  const safest = [...scored]
    .filter((scenario) => scenario.id !== bestFit?.id)
    .sort((left, right) => right.safetyScore - left.safetyScore)[0];
  const defensive = scored.find(
    (scenario) =>
      scenario.type === "wait-7-days" &&
      (scenario.projectedPastDueCount > summary.pastDueCount ||
        scenario.projectedNegativeAmount > summary.negativeAmount),
  );

  const selectedIds = new Set<string>();
  const selected: InternalScenario[] = [];
  const maxScenarios = dataQuality.level === "Sparse" ? 2 : 3;

  const pushScenario = (scenario?: InternalScenario, priority?: AdvisorScenarioResult["priority"]) => {
    if (!scenario || selectedIds.has(scenario.id) || selected.length >= maxScenarios) {
      return;
    }
    selectedIds.add(scenario.id);
    selected.push({
      ...scenario,
      priority: priority ?? scenario.priority,
      rankingReason: describeScenarioRankingReason(scenario, bestFit, safest),
      strategyInfluence: describeScenarioStrategyInfluence(scenario, preference),
      limitationNote:
        dataQuality.level === "Sparse"
          ? "Sparse data reduces confidence in smaller scenario differences."
          : undefined,
    });
  };

  pushScenario(bestFit, "Best Fit");
  if (safest && safest.safetyScore > 0 && safest.id !== bestFit?.id) {
    pushScenario(safest, "Safest");
  }
  if (defensive && defensive.id !== bestFit?.id && defensive.id !== safest?.id) {
    pushScenario(defensive, "Defensive");
  }

  for (const scenario of scored) {
    if (selected.length >= maxScenarios) {
      break;
    }
    pushScenario(scenario, scenario.type === "wait-7-days" ? "Defensive" : "Useful");
  }

  return selected;
}

function buildAdvisorResponseSummary(
  items: AdvisorItem[],
  scenarios: AdvisorScenarioResult[],
): AdvisorProviderOutput["summary"] {
  const criticalCount = items.filter((item) => item.priority === "Critical").length;
  const highCount = items.filter((item) => item.priority === "High").length;

  if (criticalCount > 0) {
    return {
      headline: `${criticalCount} critical signal${criticalCount === 1 ? "" : "s"} detected`,
      description:
        items[0]?.recommendation ??
        "Immediate bill pressure is active and should be reviewed first.",
      criticalCount,
      recommendationCount: items.length,
      scenarioCount: scenarios.length,
    };
  }

  if (highCount > 0) {
    return {
      headline: `${highCount} high-priority recommendation${highCount === 1 ? "" : "s"} available`,
      description:
        items[0]?.recommendation ??
        "There is no immediate crisis, but the next financial move is already visible.",
      criticalCount,
      recommendationCount: items.length,
      scenarioCount: scenarios.length,
    };
  }

  if (items.length > 0) {
    return {
      headline: "Calmer guidance available",
      description:
        items[0]?.recommendation ??
        "No urgent financial risks are currently visible in the active window.",
      criticalCount,
      recommendationCount: items.length,
      scenarioCount: scenarios.length,
    };
  }

  return {
    headline: "No active signals available",
    description: "Analyze the current bill set to surface ranked guidance and scenarios.",
    criticalCount,
    recommendationCount: 0,
    scenarioCount: scenarios.length,
  };
}

function buildSignalsUsed(items: AdvisorItem[], dataQuality: AdvisorDataQuality): string[] {
  const uniqueSignals = new Set<string>();

  for (const item of items.slice(0, 3)) {
    for (const signal of item.signals) {
      if (uniqueSignals.size >= 5) {
        break;
      }
      uniqueSignals.add(signal);
    }
    if (uniqueSignals.size >= 5) {
      break;
    }
  }

  if (uniqueSignals.size === 0) {
    uniqueSignals.add(dataQuality.summary);
  }

  return [...uniqueSignals];
}

function buildDebtOwnedSignals(
  debtSnapshot: AdvisorFacts["source"]["debtSnapshot"],
): string[] {
  if (debtSnapshot.accountFacts.length === 0) {
    return [];
  }

  const signals: string[] = [];
  if (debtSnapshot.summary.amountNeededToCureTotal > 0) {
    signals.push(
      `Debt reports ${formatCurrency(debtSnapshot.summary.amountNeededToCureTotal)} needed to cure active debt pressure.`,
    );
  }
  if (debtSnapshot.lifecycleAlertCount > 0) {
    signals.push(
      `Debt marks ${debtSnapshot.lifecycleAlertCount} account${debtSnapshot.lifecycleAlertCount === 1 ? "" : "s"} with active lifecycle pressure.`,
    );
  }
  const staleCount = debtSnapshot.accountFacts.filter((fact) => fact.isStale || fact.trustState === "Stale").length;
  if (staleCount > 0) {
    signals.push(
      `Debt marks ${staleCount} account${staleCount === 1 ? "" : "s"} as stale, so recent standing or term detail may need confirmation.`,
    );
  }
  if (debtSnapshot.limitedConfidenceAccountCount > 0) {
    signals.push(
      `Debt shows ${debtSnapshot.limitedConfidenceAccountCount} account${debtSnapshot.limitedConfidenceAccountCount === 1 ? "" : "s"} with limited trust${staleCount > 0 ? " beyond the stale-state accounts already flagged" : ""}.`,
    );
  }
  const estimatedCount = debtSnapshot.accountFacts.filter((fact) => fact.trustState === "Estimated").length;
  if (estimatedCount > 0) {
    signals.push(
      `Debt marks ${estimatedCount} account${estimatedCount === 1 ? "" : "s"} as estimated, so those debt details stay directional only.`,
    );
  }
  const customCount = debtSnapshot.accountFacts.filter((fact) => fact.trustState === "Custom").length;
  if (customCount > 0) {
    signals.push(
      `Debt marks ${customCount} account${customCount === 1 ? "" : "s"} as custom because payment behavior or terms were manually adjusted.`,
    );
  }
  const manualCount = debtSnapshot.accountFacts.filter((fact) => fact.trustState === "Manual").length;
  if (manualCount > 0) {
    signals.push(
      `Debt marks ${manualCount} account${manualCount === 1 ? "" : "s"} as manual, so downstream debt language stays descriptive.`,
    );
  }
  const sourceConflictCount = debtSnapshot.accountFacts.filter((fact) => fact.sourceConflict).length;
  if (sourceConflictCount > 0) {
    signals.push(
      `Debt reports ${sourceConflictCount} source conflict${sourceConflictCount === 1 ? "" : "s"} that still need verification.`,
    );
  }

  return signals;
}

function buildDebtLimitationSummary(
  debtSnapshot: AdvisorFacts["source"]["debtSnapshot"],
): string | undefined {
  const sourceConflictCount = debtSnapshot.accountFacts.filter((fact) => fact.sourceConflict).length;
  if (sourceConflictCount > 0) {
    return `Debt reports ${sourceConflictCount} source conflict${sourceConflictCount === 1 ? "" : "s"} that should be reviewed before over-trusting downstream debt detail.`;
  }
  if (debtSnapshot.limitedConfidenceAccountCount > 0) {
    return `Debt marks ${debtSnapshot.limitedConfidenceAccountCount} account${debtSnapshot.limitedConfidenceAccountCount === 1 ? "" : "s"} as limited, so debt caveats stay conservative in this run.`;
  }
  const degradedCount = debtSnapshot.accountFacts.filter((fact) =>
    fact.trustState === "Estimated" ||
    fact.trustState === "Custom" ||
    fact.trustState === "Manual" ||
    fact.trustState === "Stale",
  ).length;
  if (degradedCount > 0) {
    return `Debt marks ${degradedCount} account${degradedCount === 1 ? "" : "s"} with non-exact trust, so debt language stays factual and avoids over-precision.`;
  }
  return undefined;
}

export function buildAdvisorAnalysis({
  context,
  bills,
  summary,
  reporting,
  includePaidInTotals,
  preference,
  tracking,
  source,
}: AdvisorInput): AdvisorProviderOutput {
  const unpaidMeta = bills
    .filter((bill) => bill.status !== "Paid")
    .map((bill) => withUrgency(buildBillMeta(bill, summary), summary))
    .sort((left, right) => right.urgencyScore - left.urgencyScore);
  const metaById = new Map(unpaidMeta.map((item) => [item.bill.id, item]));
  const overdueBills = unpaidMeta.filter((item) => item.isPastDue);
  const upcomingBills = unpaidMeta.filter((item) => item.isUpcoming);
  const dueSoonBills = upcomingBills.filter((item) => item.isDueSoon);
  const feeBearingBills = unpaidMeta.filter((item) => item.lateFeeAmount > 0);
  const essentialBills = unpaidMeta.filter((item) => item.isEssential);
  const topUrgent = unpaidMeta[0];
  const topOverdue = overdueBills[0];
  const topLateFeeBill = pickBillWithHighestLateFee(feeBearingBills);
  const topStrategicDecision = pickStrategicBill(unpaidMeta, preference, summary);
  const dataQuality = buildDataQuality(bills, unpaidMeta, summary, reporting);
  const profile = getConfidenceProfile(context, dataQuality);
  const exposureHistory = buildExposureHistory(tracking);
  const trackingSummary = buildTrackingSummary(tracking, summary, preference, exposureHistory);

  const overdueTotal = sumAmounts(overdueBills.map((item) => item.totalAmount));
  const currentLateFeeTotal = sumAmounts(feeBearingBills.map((item) => item.lateFeeAmount));
  const dueSoonEssentials = dueSoonBills.filter((item) => item.isEssential);
  const essentialPressureTotal = sumAmounts(essentialBills.map((item) => item.totalAmount));
  const dueSoonPressureTotal = sumAmounts(dueSoonBills.map((item) => item.totalAmount));
  const upcomingCategoryTotals = dueSoonBills.reduce<Map<BillCategory, number>>((map, item) => {
    map.set(
      item.bill.category,
      normalizeAmount((map.get(item.bill.category) ?? 0) + item.totalAmount),
    );
    return map;
  }, new Map());
  const upcomingCategoryCounts = dueSoonBills.reduce<Map<BillCategory, number>>((map, item) => {
    map.set(item.bill.category, (map.get(item.bill.category) ?? 0) + 1);
    return map;
  }, new Map());

  const unpaidCategoryTotals = unpaidMeta.reduce<Map<BillCategory, number>>((map, item) => {
    map.set(item.bill.category, normalizeAmount((map.get(item.bill.category) ?? 0) + item.totalAmount));
    return map;
  }, new Map());
  const unpaidCategoryCounts = unpaidMeta.reduce<Map<BillCategory, number>>((map, item) => {
    map.set(item.bill.category, (map.get(item.bill.category) ?? 0) + 1);
    return map;
  }, new Map());
  const lateFeeCategoryTotals = feeBearingBills.reduce<Map<BillCategory, number>>((map, item) => {
    map.set(item.bill.category, normalizeAmount((map.get(item.bill.category) ?? 0) + item.lateFeeAmount));
    return map;
  }, new Map());
  const lateFeeCategoryCounts = feeBearingBills.reduce<Map<BillCategory, number>>((map, item) => {
    map.set(item.bill.category, (map.get(item.bill.category) ?? 0) + 1);
    return map;
  }, new Map());

  const topUnpaidCategoryEntry = [...unpaidCategoryTotals.entries()].sort((left, right) => right[1] - left[1])[0];
  const topReportingLateFeeCategory = [...reporting.categoryBreakdown]
    .sort((left, right) => right.lateFees - left.lateFees)[0];

  const candidates: Candidate[] = [];

  if (summary.pastDueCount > 0) {
    const signals = [
      `${summary.pastDueCount} past-due bill${summary.pastDueCount === 1 ? "" : "s"}`,
      `${formatCurrency(overdueTotal)} overdue total`,
    ];
    if (topOverdue?.lateFeeAmount) {
      signals.push(`${formatCurrency(topOverdue.lateFeeAmount)} applied late fee on ${topOverdue.bill.name}`);
    }

    candidates.push(
      buildCandidate(profile, {
        id: "priority-alert-past-due",
        category: "Priority Alert",
        recommendationType: "Priority Alert",
        priority: "Critical",
        title: "Past-due bills need immediate attention",
        recommendation: topOverdue
          ? `Start with ${topOverdue.bill.name} to reduce overdue pressure fastest.`
          : "Resolve one past-due bill first to stabilize the ledger.",
        why: createWhy(signals),
        impact: `Past-due count can drop from ${summary.pastDueCount} to ${Math.max(
          0,
          summary.pastDueCount - 1,
        )}, and active fee pressure can fall by up to ${formatCurrency(topOverdue?.lateFeeAmount ?? 0)}.`,
        score: 150 + summary.pastDueCount * 12 + overdueTotal * 0.03,
        signalStrength: signals.length + 2,
        signals,
        rankingReason:
          dueSoonBills.length > 0
            ? "Ranks first because existing overdue pressure outranks due-soon risk until the overdue queue is reduced."
            : undefined,
        action: { type: "filterPastDue" },
        actionLabel: "Review Past Due Bills",
      }),
    );
  }

  if (topStrategicDecision.chosen ?? topUrgent) {
    const billToRecommend = topStrategicDecision.chosen ?? topUrgent;
    if (billToRecommend) {
      const signals = [
        `${formatCurrency(billToRecommend.totalAmount)} total amount`,
        `${formatPercent(billToRecommend.balanceImpactPercent)} of remaining balance base`,
        STRATEGY_LABEL[preference.strategy],
      ];
      if (billToRecommend.isPastDue) {
        signals.push("past due");
      } else if (billToRecommend.daysUntilDue !== null) {
        signals.push(`due in ${Math.max(0, billToRecommend.daysUntilDue)} day${billToRecommend.daysUntilDue === 1 ? "" : "s"}`);
      }
      if (billToRecommend.lateFeeAmount > 0) {
        signals.push(`${formatCurrency(billToRecommend.lateFeeAmount)} applied late fee`);
      }

      candidates.push(
        buildCandidate(profile, {
          id: `pay-first-${billToRecommend.bill.id}`,
          category: "Recommendation",
          recommendationType: "Pay First",
          priority: billToRecommend.isPastDue ? "High" : "Medium",
          title: getPayFirstTitle(preference.strategy, billToRecommend.bill.name),
          recommendation: getPayFirstRecommendation(preference.strategy, billToRecommend),
          why: createWhy(signals),
          impact: billToRecommend.isPastDue
            ? `Clearing it removes ${formatCurrency(billToRecommend.totalAmount)} from the overdue queue and can reduce late-fee pressure by ${formatCurrency(
                billToRecommend.lateFeeAmount,
              )}.`
            : `Handling it now keeps the due-soon queue from becoming overdue and protects current balance stability.`,
          score: 86 + billToRecommend.urgencyScore * 0.34,
          signalStrength: signals.length + 1,
          signals,
          rankingReason: topStrategicDecision.outrankReason,
          strategyInfluence: topStrategicDecision.strategyInfluence,
          limitationNote:
            dataQuality.level === "Sparse"
              ? "Sparse history means this is a best-fit call, not a fully conclusive one."
              : undefined,
          focusBillId: billToRecommend.bill.id,
          focusCategory: billToRecommend.bill.category,
          action: { type: "searchBill", query: billToRecommend.bill.name },
          actionLabel: `Open ${billToRecommend.bill.name}`,
        }),
      );
    }
  }

  const watchNextBill = dueSoonBills
    .filter((item) => !item.isPastDue)
    .sort((left, right) => {
      const leftDays = left.daysUntilDue ?? 999;
      const rightDays = right.daysUntilDue ?? 999;
      if (leftDays !== rightDays) {
        return leftDays - rightDays;
      }
      return right.totalAmount - left.totalAmount;
    })[0];

  if (watchNextBill) {
    const signals = [
      `due in ${Math.max(0, watchNextBill.daysUntilDue ?? 0)} day${(watchNextBill.daysUntilDue ?? 0) === 1 ? "" : "s"}`,
      `${formatCurrency(watchNextBill.totalAmount)} obligation`,
    ];
    if (watchNextBill.totalAmount > Math.max(summary.balanceLeft, 0)) {
      signals.push("can pressure current balance left on its own");
    }
    if (watchNextBill.lateFeeAmount > 0) {
      signals.push(`${formatCurrency(watchNextBill.lateFeeAmount)} already applied in fees`);
    }

    candidates.push(
      buildCandidate(profile, {
        id: `watch-next-${watchNextBill.bill.id}`,
        category: "Preventive Guidance",
        recommendationType: "Watch Next",
        priority: watchNextBill.isImmediate ? "High" : "Medium",
        title: `${watchNextBill.bill.name} is the next bill to watch`,
        recommendation: `Review ${watchNextBill.bill.name} before it rolls into the overdue queue.`,
        why: createWhy(signals),
        impact: "Acting before deadline keeps overdue count flat and prevents the next near-term problem from forming.",
        score: 72 + watchNextBill.urgencyScore * 0.3,
        signalStrength: signals.length,
        signals,
        rankingReason: `Ranks ahead of other due-soon bills because ${watchNextBill.bill.name} lands earlier with stronger balance impact.`,
        focusBillId: watchNextBill.bill.id,
        action: { type: "searchBill", query: watchNextBill.bill.name },
        actionLabel: `Open ${watchNextBill.bill.name}`,
      }),
    );
  }

  const repeatedFeeCategoryEntry = [...lateFeeCategoryCounts.entries()]
    .filter((entry) => entry[1] > 1)
    .sort((left, right) => {
      const lateFeeCompare =
        (lateFeeCategoryTotals.get(right[0]) ?? 0) - (lateFeeCategoryTotals.get(left[0]) ?? 0);
      if (lateFeeCompare !== 0) {
        return lateFeeCompare;
      }
      return right[1] - left[1];
    })[0];

  if (topLateFeeBill || repeatedFeeCategoryEntry) {
    const feeCategory = repeatedFeeCategoryEntry?.[0] ?? topLateFeeBill?.bill.category;
    const feeTotal = feeCategory ? lateFeeCategoryTotals.get(feeCategory) ?? 0 : 0;
    const feeCount = feeCategory ? lateFeeCategoryCounts.get(feeCategory) ?? 0 : 0;
    const signals: string[] = [];
    if (topLateFeeBill) {
      signals.push(`${topLateFeeBill.bill.name} carries ${formatCurrency(topLateFeeBill.lateFeeAmount)} in applied late fees`);
    }
    if (feeCategory && feeCount > 1) {
      signals.push(`${feeCategory} has ${feeCount} fee-bearing bills`);
    }
    if (feeTotal > 0) {
      signals.push(`${formatCurrency(feeTotal)} fee pressure in ${feeCategory}`);
    }

    candidates.push(
      buildCandidate(profile, {
        id: `prevent-fee-risk-${feeCategory ?? topLateFeeBill?.bill.id ?? "general"}`,
        category: "Preventive Guidance",
        recommendationType: "Prevent Fee Risk",
        priority: "High",
        title: feeCategory
          ? `${feeCategory} is creating repeated fee pressure`
          : "Applied late fees are now avoidable cost",
        recommendation: topLateFeeBill
          ? `Address ${topLateFeeBill.bill.name} first to stop fee drag from compounding.`
          : "Review fee-bearing bills before new obligations are added.",
        why: createWhy(signals),
        impact: `Reducing this pocket of fee pressure protects cash and lowers the current ${formatCurrency(
          currentLateFeeTotal,
        )} in active late fees.`,
        score: 116 + feeTotal * 0.75 + feeCount * 18,
        signalStrength: Math.max(3, signals.length),
        signals,
        strategyInfluence:
          preference.strategy === "minimize-late-fees" || preference.strategy === "avalanche"
            ? "Strategy influence: fee-heavy pressure is currently weighted above smaller non-fee obligations."
            : undefined,
        focusCategory: feeCategory,
        action: feeCategory
          ? { type: "filterCategory", category: feeCategory }
          : { type: "goToBills" },
        actionLabel: feeCategory ? `Focus ${feeCategory}` : "Open Bills",
      }),
    );
  }

  if (summary.dueIn7DaysCount >= 3 || (summary.dueIn7DaysCount > 0 && summary.dueIn7DaysTotal > Math.max(summary.balanceLeft, 0))) {
    const signals = [
      `${summary.dueIn7DaysCount} bill${summary.dueIn7DaysCount === 1 ? "" : "s"} due in 7 days`,
      `${formatCurrency(summary.dueIn7DaysTotal)} due soon`,
    ];
    if (summary.dueIn7DaysTotal > Math.max(summary.balanceLeft, 0)) {
      signals.push("due-soon pressure is larger than current balance left");
    }

    candidates.push(
      buildCandidate(profile, {
        id: "reduce-upcoming-pressure",
        category: context === "reporting" ? "Trend Commentary" : "Preventive Guidance",
        recommendationType: "Reduce Upcoming Pressure",
        priority: summary.dueIn7DaysTotal > Math.max(summary.balanceLeft, 0) ? "High" : "Medium",
        title: "Upcoming bills are clustering into one pressure window",
        recommendation: "Sequence the next 7 days now so multiple bills do not tip the dashboard into reactive mode.",
        why: createWhy(signals),
        impact: "This reduces the chance that several upcoming bills convert into one overdue cluster.",
        score: 82 + summary.dueIn7DaysCount * 10 + summary.dueIn7DaysTotal * 0.05,
        signalStrength: signals.length + 1,
        signals,
        rankingReason:
          summary.dueIn7DaysTotal > Math.max(summary.balanceLeft, 0)
            ? "Ranks highly because near-term due pressure is larger than current balance left."
            : "Ranks highly because several bills are compressing into one short window.",
        action: { type: "filterDueSoon" },
        actionLabel: "Review Due Soon Bills",
      }),
    );
  }

  const emergingCategoryEntry = [...upcomingCategoryTotals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      count: upcomingCategoryCounts.get(category) ?? 0,
    }))
    .filter((entry) => entry.count >= 2 || entry.total >= Math.max(220, summary.dueIn7DaysTotal * 0.38))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return right.total - left.total;
    })[0];

  if (emergingCategoryEntry) {
    const signals = [
      `${emergingCategoryEntry.count} due-soon bill${emergingCategoryEntry.count === 1 ? "" : "s"} in ${emergingCategoryEntry.category}`,
      `${formatCurrency(emergingCategoryEntry.total)} due shortly in this category`,
    ];
    if (ESSENTIAL_CATEGORIES.has(emergingCategoryEntry.category)) {
      signals.push("category is essential");
    }

    candidates.push(
      buildCandidate(profile, {
        id: `emerging-risk-pocket-${emergingCategoryEntry.category}`,
        category: "Preventive Guidance",
        recommendationType: "Watch Next",
        priority: ESSENTIAL_CATEGORIES.has(emergingCategoryEntry.category) ? "High" : "Medium",
        title: `${emergingCategoryEntry.category} is the next fragile pocket`,
        recommendation: `Review ${emergingCategoryEntry.category} now before the next due cluster becomes the next overdue problem.`,
        why: createWhy(signals),
        impact: "This addresses the category most likely to create the next pressure jump if nothing changes.",
        score: 76 + emergingCategoryEntry.total * 0.05 + emergingCategoryEntry.count * 12,
        signalStrength: signals.length + 1,
        signals,
        rankingReason: "This category outranks other near-term pockets because it combines multiple due-soon bills into one fragile window.",
        focusCategory: emergingCategoryEntry.category,
        action: { type: "filterCategory", category: emergingCategoryEntry.category },
        actionLabel: `Focus ${emergingCategoryEntry.category}`,
      }),
    );
  }

  if (
    essentialBills.length >= 2 &&
    (dueSoonEssentials.length > 0 || essentialPressureTotal > Math.max(summary.balanceLeft, 0))
  ) {
    const signals = [
      `${essentialBills.length} essential bill${essentialBills.length === 1 ? "" : "s"}`,
      `${formatCurrency(essentialPressureTotal)} in essential pressure`,
    ];
    if (dueSoonEssentials.length > 0) {
      signals.push(`${dueSoonEssentials.length} essential bill${dueSoonEssentials.length === 1 ? "" : "s"} due soon`);
    }

    candidates.push(
      buildCandidate(profile, {
        id: "protect-essentials",
        category: "Preventive Guidance",
        recommendationType: "Protect Essentials",
        priority: dueSoonEssentials.length > 0 || summary.pastDueCount > 0 ? "High" : "Medium",
        title: "Essential categories need to stay ahead of pressure",
        recommendation: "Stabilize housing, utilities, insurance, groceries, and debt before discretionary bills absorb attention.",
        why: createWhy(signals),
        impact: "This protects the categories most likely to cause real disruption if they slip behind.",
        score: 84 + essentialPressureTotal * 0.04 + dueSoonEssentials.length * 12,
        signalStrength: signals.length + 1,
        signals,
        strategyInfluence:
          preference.strategy === "protect-essentials"
            ? "Strategy influence: essential-category stability is explicitly prioritized."
            : undefined,
        action: { type: "goToBills" },
        actionLabel: "Open Bills",
      }),
    );
  }

  if (summary.balanceLeft < preference.minimumCashBuffer || (summary.balanceLeft > 0 && dueSoonPressureTotal > summary.balanceLeft)) {
    const discretionaryBill = unpaidMeta
      .filter((item) => item.isDiscretionary)
      .sort((left, right) => right.totalAmount - left.totalAmount)[0];

    const signals = [];
    if (summary.balanceLeft < preference.minimumCashBuffer) {
      signals.push(`${formatCurrency(preference.minimumCashBuffer)} preferred cash buffer versus ${formatCurrency(summary.balanceLeft)} balance left`);
    }
    if (summary.balanceLeft > 0 && dueSoonPressureTotal > summary.balanceLeft) {
      signals.push(`${formatCurrency(dueSoonPressureTotal)} due soon versus ${formatCurrency(summary.balanceLeft)} balance left`);
    }
    if (discretionaryBill) {
      signals.push(`${discretionaryBill.bill.category} includes ${formatCurrency(discretionaryBill.totalAmount)} in discretionary pressure`);
    }

    candidates.push(
      buildCandidate(profile, {
        id: "cash-preservation-move",
        category: "Recommendation",
        recommendationType: "Cash Preservation Move",
        priority: summary.balanceLeft < 0 ? "Critical" : "High",
        title: "Protect the remaining cash buffer",
        recommendation: discretionaryBill
          ? `Review ${discretionaryBill.bill.name} after core obligations are secured to keep the remaining buffer intact.`
          : "Prioritize core obligations first until the near-term buffer is safer.",
        why: createWhy(signals),
        impact: "This reduces the chance of balance stress worsening before the next due cycle.",
        score:
          72 +
          Math.max(preference.minimumCashBuffer - summary.balanceLeft, 0) * 0.06 +
          Math.max(dueSoonPressureTotal - summary.balanceLeft, 0) * 0.035 -
          summary.pastDueCount * 18,
        signalStrength: signals.length + 1,
        signals,
        strategyInfluence:
          preference.strategy === "preserve-cash-buffer"
            ? "Strategy influence: remaining cash buffer is being protected ahead of lower-priority spend."
            : undefined,
        focusBillId: discretionaryBill?.bill.id,
        focusCategory: discretionaryBill?.bill.category,
        action: discretionaryBill
          ? { type: "searchBill", query: discretionaryBill.bill.name }
          : { type: "goToBills" },
        actionLabel: discretionaryBill ? `Review ${discretionaryBill.bill.name}` : "Open Bills",
      }),
    );
  }

  if (topUnpaidCategoryEntry) {
    const [category, total] = topUnpaidCategoryEntry;
    const share = summary.unpaidTotal > 0 ? normalizeAmount((total / summary.unpaidTotal) * 100) : 0;
    const count = unpaidCategoryCounts.get(category) ?? 0;

    if (share >= 45 && count >= 2) {
      const signals = [
        `${formatPercent(share)} of unpaid obligations`,
        `${formatCurrency(total)} concentrated in ${category}`,
        `${count} active bill${count === 1 ? "" : "s"} in this category`,
      ];
      const concentrationIsSevere = share >= 75 || total >= Math.max(summary.unpaidTotal * 0.7, 1200);

      candidates.push(
        buildCandidate(profile, {
          id: `biggest-category-risk-${category}`,
          category: context === "reporting" ? "Trend Commentary" : "Recommendation",
          recommendationType: "Biggest Category Risk",
          priority: concentrationIsSevere || share >= 60 ? "High" : "Medium",
          title: `${category} is the biggest category risk`,
          recommendation: `Review ${category} first to reduce single-category pressure.`,
          why: createWhy(signals),
          impact: "Lower concentration improves resilience and reduces the chance that one category dominates cashflow decisions.",
          score: 118 + share * 0.82 + count * 8 + Math.min(36, total * 0.02),
          signalStrength: signals.length,
          signals,
          rankingReason: `${category} outranks other categories because it holds the largest current share of unpaid pressure.`,
          focusCategory: category,
          action: { type: "filterCategory", category },
          actionLabel: `Review ${category}`,
        }),
      );
    }
  }

  const worseningSignals = [
    reporting.totalLateFeesDelta.delta > 0
      ? `late fees up ${formatCurrency(Math.abs(reporting.totalLateFeesDelta.delta))}`
      : null,
    reporting.pastDueCountDelta.delta > 0
      ? `past-due count up ${reporting.pastDueCountDelta.delta.toFixed(0)}`
      : null,
    reporting.topCategory && reporting.topCategoryPercent >= 45
      ? `${reporting.topCategory} is ${formatPercent(reporting.topCategoryPercent)} of this period`
      : null,
  ].filter((signal): signal is string => Boolean(signal));

  if (worseningSignals.length > 0) {
    candidates.push(
      buildCandidate(profile, {
        id: "trend-warning",
        category: "Trend Commentary",
        recommendationType: "Trend Warning",
        priority: worseningSignals.length >= 2 ? "High" : "Medium",
        title: "This reporting window is worsening",
        recommendation:
          "Use the reporting view to isolate the bills and categories driving deterioration before the next cycle.",
        why: createWhy(worseningSignals),
        impact: "Catching the driver early helps stop higher fees and a growing overdue queue from carrying into the next period.",
        score:
          94 +
          Math.abs(reporting.totalLateFeesDelta.delta) * 0.4 +
          Math.abs(reporting.pastDueCountDelta.delta) * 12,
        signalStrength: worseningSignals.length + 1,
        signals: worseningSignals,
        action: { type: "goToReporting" },
        actionLabel: "Inspect Reporting",
      }),
    );
  }

  const improvingSignals = [
    reporting.totalLateFeesDelta.delta < 0
      ? `late fees down ${formatCurrency(Math.abs(reporting.totalLateFeesDelta.delta))}`
      : null,
    reporting.pastDueCountDelta.delta < 0
      ? `past-due count down ${Math.abs(reporting.pastDueCountDelta.delta).toFixed(0)}`
      : null,
  ].filter((signal): signal is string => Boolean(signal));

  if (improvingSignals.length > 0) {
    candidates.push(
      buildCandidate(profile, {
        id: "improvement-signal",
        category: "Trend Commentary",
        recommendationType: "Improvement Signal",
        priority: "Medium",
        title: "Recent bill pressure is improving",
        recommendation: "Keep the same payment discipline while the current improvement is still holding.",
        why: createWhy(improvingSignals),
        impact: "Sustaining this pattern improves balance stability and lowers avoidable cost over time.",
        score: 62 + Math.abs(reporting.totalLateFeesDelta.delta) * 0.25 + Math.abs(reporting.pastDueCountDelta.delta) * 8,
        signalStrength: improvingSignals.length,
        signals: improvingSignals,
        action: { type: "goToReporting" },
        actionLabel: "Review Improvement",
      }),
    );
  }

  if (context === "reporting" && topReportingLateFeeCategory && topReportingLateFeeCategory.lateFees > 0) {
    const signals = [
      `${topReportingLateFeeCategory.category} generated ${formatCurrency(topReportingLateFeeCategory.lateFees)} in this period`,
      `${formatPercent(topReportingLateFeeCategory.percentOfTotal)} of current period obligations`,
    ];

    candidates.push(
      buildCandidate(profile, {
        id: `reporting-fee-driver-${topReportingLateFeeCategory.category}`,
        category: "Trend Commentary",
        recommendationType: "Trend Warning",
        priority: "Medium",
        title: `${topReportingLateFeeCategory.category} is the biggest fee driver`,
        recommendation: `Review ${topReportingLateFeeCategory.category} first when diagnosing reporting deterioration.`,
        why: createWhy(signals),
        impact: "This narrows the reporting story to the category most responsible for fee drag in the selected period.",
        score: 76 + topReportingLateFeeCategory.lateFees * 0.55,
        signalStrength: signals.length,
        signals,
        focusCategory: topReportingLateFeeCategory.category,
        action: { type: "filterCategory", category: topReportingLateFeeCategory.category },
        actionLabel: `Focus ${topReportingLateFeeCategory.category}`,
      }),
    );
  }

  if (trackingSummary.note) {
    const signals = [
      trackingSummary.followedCount > 0
        ? `${trackingSummary.followedCount} prior advisor-led action${trackingSummary.followedCount === 1 ? "" : "s"}`
        : "strategy history available",
      STRATEGY_LABEL[preference.strategy],
    ];

    candidates.push(
      buildCandidate(profile, {
        id: "tracking-feedback",
        category: "Trend Commentary",
        recommendationType: trackingSummary.note.includes("down") || trackingSummary.note.includes("improved")
          ? "Improvement Signal"
          : "Trend Warning",
        priority: "Medium",
        title: "Recent advisor outcomes are visible in your data",
        recommendation: trackingSummary.note,
        why: createWhy(signals),
        impact: "This uses actual changes in your tracked ledger to keep the advisor grounded over time.",
        score: 58 + trackingSummary.followedCount * 6,
        signalStrength: signals.length,
        signals,
        action: context === "reporting" ? { type: "goToReporting" } : { type: "goToBills" },
        actionLabel: context === "reporting" ? "Open Reporting" : "Open Bills",
      }),
    );
  }

  if (summary.activeBillCount === 0 && bills.length > 0) {
    const signals = [
      "no active unpaid bills",
      `${bills.length} tracked bill${bills.length === 1 ? "" : "s"} in history`,
    ];
    candidates.push(
      buildCandidate(profile, {
        id: "all-bills-paid",
        category: "Trend Commentary",
        recommendationType: "Improvement Signal",
        priority: "Medium",
        title: "No active bill pressure is showing",
        recommendation: "Keep the ledger current and use reporting to watch for the next concentration shift.",
        why: createWhy(signals),
        impact: "Maintains a clean working state without introducing unnecessary urgency.",
        score: 54,
        signalStrength: signals.length,
        signals,
        action: { type: "goToOverview" },
        actionLabel: "Return To Overview",
      }),
    );
  }

  const contextualized = candidates
    .map((candidate) => withContextScore(candidate, context))
    .map((candidate) => withStrategyScore(candidate, preference, summary, metaById));
  const selected = selectCandidates(contextualized, profile.maxItems, exposureHistory);

  const fallback: AdvisorItem[] = [
    {
      id: "advisor-stable-default",
      category: "Preventive Guidance",
      recommendationType: "Watch Next",
      priority: "Medium",
      confidence: profile.tier,
      title: "No urgent financial risks are currently visible",
      recommendation: "Keep upcoming bills reviewed weekly and continue updating the ledger as new obligations arrive.",
      why:
        profile.tier === "Light"
          ? "Driven by limited active data and no strong overdue or fee signals."
          : "Driven by the absence of overdue, fee, and deterioration signals in current data.",
      impact: "This keeps the dashboard stable and makes future risk changes easier to spot quickly.",
      score: 40,
      signals: [profile.summaryLabel],
      action: { type: "goToOverview" },
      actionLabel: "Return To Overview",
    },
  ];

  const rankedItems = selected.length > 0 ? selected : fallback;
  const scenarios = buildScenarios(
      bills,
      unpaidMeta,
      summary,
      includePaidInTotals,
      preference,
      dataQuality,
      exposureHistory,
    );
  const debtOwnedSignals = buildDebtOwnedSignals(source.debtSnapshot);
  const debtLimitationSummary = buildDebtLimitationSummary(source.debtSnapshot);
  const explainability = `This run evaluates overdue status, due-date proximity, applied late fees, balance pressure, category concentration, reporting deltas, and the ${STRATEGY_LABEL[preference.strategy]} strategy. Debt-owned lifecycle, cash-window, cure, trust, and continuity facts stay owned by Debt and are carried forward without recalculation. ${dataQuality.summary}`;

  return {
    summary: buildAdvisorResponseSummary(rankedItems, scenarios),
    ladder: rankedItems.slice(0, 3).map((item, index) => ({
      slot: index === 0 ? "Now" : index === 1 ? "Next" : "Then",
      recommendationId: item.id,
      title: item.title,
      description: item.recommendation,
      focusBillId: item.focusBillId,
      focusCategory: item.focusCategory,
      whyNow: item.whyNow,
      action: item.action,
      actionLabel: item.actionLabel,
    })),
    deltaSinceLastRun: undefined,
    rankedItems,
    sections: {
      priorityAlerts: rankedItems.filter((item) => item.category === "Priority Alert"),
      recommendations: rankedItems.filter((item) => item.category === "Recommendation"),
      preventiveGuidance: rankedItems.filter(
        (item) => item.category === "Preventive Guidance",
      ),
      trendCommentary: rankedItems.filter((item) => item.category === "Trend Commentary"),
    },
    scenarios,
    trust: {
      explainability,
      signalsUsed: [...buildSignalsUsed(rankedItems, dataQuality), ...debtOwnedSignals].slice(0, 7),
      dataQuality,
      tracking: trackingSummary,
      limitationSummary:
        dataQuality.level === "Strong"
          ? debtLimitationSummary
          : [dataQuality.issues[0] ?? dataQuality.summary, debtLimitationSummary]
              .filter((value): value is string => Boolean(value))
              .join(" "),
    },
    recommendationStates: [],
  };
}

export function buildAdvisorItems(input: AdvisorInput): AdvisorItem[] {
  return buildAdvisorAnalysis(input).rankedItems;
}
