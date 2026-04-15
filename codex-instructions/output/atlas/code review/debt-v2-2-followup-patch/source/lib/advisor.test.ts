import { describe, expect, it } from "vitest";
import { buildAdvisorAnalysis, buildAdvisorItems } from "@/lib/advisor";
import { ADVISOR_FACTS_VERSION } from "@/lib/advisor-contracts";
import type { AdvisorPreference, AdvisorTrackingEvent, Bill } from "@/lib/types";
import { calculateReportingSnapshot, calculateSummary } from "@/lib/utils";

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

function buildAnalysis(
  bills: Bill[],
  options?: {
    startingBalance?: number;
    includePaidInTotals?: boolean;
    strategy?: AdvisorPreference["strategy"];
    minimumCashBuffer?: number;
    context?: "overview" | "planning" | "reporting" | "all";
    tracking?: AdvisorTrackingEvent[];
  },
) {
  const summary = calculateSummary(
    bills,
    options?.startingBalance ?? 1500,
    options?.includePaidInTotals ?? false,
  );
  const reporting = calculateReportingSnapshot(bills, "month");

  return buildAdvisorAnalysis({
    version: ADVISOR_FACTS_VERSION,
    context: options?.context ?? "overview",
    reportingRange: "month",
    startingBalance: options?.startingBalance ?? 1500,
    includePaidInTotals: options?.includePaidInTotals ?? false,
    source: {
      kind: "supabase",
      userId: "test-user",
      debtAccounts: [],
      debtSnapshot: {
        summary: {
          totalDebtBalance: 0,
          activeAccountCount: 0,
          delinquentAccountCount: 0,
          lateAccountCount: 0,
          noPaymentRequiredCount: 0,
          activeHardshipCount: 0,
          failedPaymentCount: 0,
          collectionsCount: 0,
          amountNeededToCureTotal: 0,
          requiredPaymentsIn14Days: 0,
          requiredPaymentsIn30Days: 0,
          requiredPaymentsIn60Days: 0,
          minimumCashNeededIn14Days: 0,
          minimumCashNeededIn30Days: 0,
          minimumCashNeededIn60Days: 0,
          totalMinimumDueIn60Days: 0,
          nextDebtDueAmount: 0,
          timingClusterCount: 0,
        },
        accountFacts: [],
        nearTermObligations: [],
        confidenceSummary: {
          Exact: 0,
          Estimated: 0,
          Limited: 0,
          Custom: 0,
          Manual: 0,
        },
        flaggedAccountCount: 0,
        consequenceAccountCount: 0,
        limitedConfidenceAccountCount: 0,
        lifecycleAlertCount: 0,
        boundedOperationalWindowDays: 60,
      },
    },
    bills,
    summary,
    reporting,
    preference: {
      strategy: options?.strategy ?? "reduce-overdue-count",
      minimumCashBuffer: options?.minimumCashBuffer ?? 200,
    },
    tracking: options?.tracking ?? [],
  });
}

describe("buildAdvisorAnalysis", () => {
  it("returns calm light-confidence guidance for sparse healthy data", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "single-upcoming",
        name: "Internet",
        dueDate: getOffsetDateString(5),
        amount: 45,
      }),
    ]);

    expect(analysis.rankedItems.length).toBeLessThanOrEqual(2);
    expect(analysis.rankedItems[0]?.confidence).toBe("Light");
    expect(analysis.trust.dataQuality.level).toBe("Sparse");
  });

  it("prioritizes past-due pressure first when multiple overdue bills exist", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "car-loan",
        name: "Car Loan",
        category: "Debt",
        status: "Past Due",
        dueDate: getOffsetDateString(-7),
        amount: 420,
        lateFeeAmount: 35,
      }),
      createBill({
        id: "power",
        name: "Power Utility",
        category: "Utilities",
        status: "Past Due",
        dueDate: getOffsetDateString(-4),
        amount: 180,
      }),
      createBill({
        id: "rent",
        name: "Rent",
        category: "Rent / Housing",
        status: "Upcoming",
        dueDate: getOffsetDateString(2),
        amount: 1400,
      }),
    ]);

    expect(analysis.rankedItems[0]?.recommendationType).toBe("Priority Alert");
    expect(analysis.rankedItems[0]?.title.toLowerCase()).toContain("past-due");
    expect(analysis.rankedItems[0]?.priority).toBe("Critical");
  });

  it("adds a cash-preservation move when obligations push balance negative", () => {
    const analysis = buildAnalysis(
      [
        createBill({
          id: "rent",
          name: "Rent",
          category: "Rent / Housing",
          dueDate: getOffsetDateString(2),
          amount: 1200,
        }),
        createBill({
          id: "insurance",
          name: "Insurance",
          category: "Insurance",
          dueDate: getOffsetDateString(4),
          amount: 420,
        }),
        createBill({
          id: "streaming",
          name: "Streaming",
          category: "Subscription",
          dueDate: getOffsetDateString(5),
          amount: 55,
        }),
      ],
      { startingBalance: 1000, strategy: "preserve-cash-buffer", minimumCashBuffer: 250 },
    );

    expect(
      analysis.rankedItems.some(
        (item) => item.recommendationType === "Cash Preservation Move",
      ),
    ).toBe(true);
  });

  it("produces fee-risk guidance when late-fee pressure is concentrated", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "car-loan",
        name: "Car Loan",
        category: "Debt",
        status: "Past Due",
        dueDate: getOffsetDateString(-6),
        amount: 350,
        lateFeeAmount: 30,
      }),
      createBill({
        id: "credit-line",
        name: "Credit Line",
        category: "Debt",
        status: "Upcoming",
        dueDate: getOffsetDateString(3),
        amount: 210,
        lateFeeAmount: 15,
      }),
      createBill({
        id: "internet",
        name: "Internet",
        category: "Utilities",
        dueDate: getOffsetDateString(4),
        amount: 80,
      }),
      createBill({
        id: "insurance",
        name: "Insurance",
        category: "Insurance",
        dueDate: getOffsetDateString(9),
        amount: 120,
      }),
    ], { context: "planning" });

    expect(
      analysis.rankedItems.some(
        (item) => item.recommendationType === "Prevent Fee Risk",
      ),
    ).toBe(true);
  });

  it("triggers preventive guidance for upcoming pressure clusters", () => {
    const analysis = buildAnalysis(
      [
        createBill({ id: "a", name: "Rent", category: "Rent / Housing", dueDate: getOffsetDateString(1), amount: 950 }),
        createBill({ id: "b", name: "Power", category: "Utilities", dueDate: getOffsetDateString(2), amount: 180 }),
        createBill({ id: "c", name: "Insurance", category: "Insurance", dueDate: getOffsetDateString(3), amount: 240 }),
        createBill({ id: "d", name: "Internet", category: "Services", dueDate: getOffsetDateString(5), amount: 75 }),
      ],
      { startingBalance: 800 },
    );

    expect(
      analysis.rankedItems.some(
        (item) => item.recommendationType === "Reduce Upcoming Pressure",
      ),
    ).toBe(true);
  });

  it("triggers protect-essentials guidance when essential pressure is dominant", () => {
    const analysis = buildAnalysis([
      createBill({ id: "a", name: "Rent", category: "Rent / Housing", dueDate: getOffsetDateString(1), amount: 900 }),
      createBill({ id: "b", name: "Power", category: "Utilities", dueDate: getOffsetDateString(2), amount: 180 }),
      createBill({ id: "c", name: "Groceries", category: "Groceries", dueDate: getOffsetDateString(4), amount: 160 }),
      createBill({ id: "d", name: "Streaming", category: "Subscription", dueDate: getOffsetDateString(4), amount: 18 }),
    ]);

    expect(
      analysis.rankedItems.some(
        (item) => item.recommendationType === "Protect Essentials",
      ),
    ).toBe(true);
  });

  it("returns an all-paid improvement signal when no active bills remain", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "paid-one",
        name: "Streaming",
        status: "Paid",
        dueDate: getOffsetDateString(-1),
        paidDate: getOffsetDateString(-1),
        amount: 30,
      }),
      createBill({
        id: "paid-two",
        name: "Insurance",
        category: "Insurance",
        status: "Paid",
        dueDate: getOffsetDateString(-3),
        paidDate: getOffsetDateString(-3),
        amount: 110,
      }),
    ]);

    expect(
      analysis.rankedItems.some(
        (item) => item.recommendationType === "Improvement Signal",
      ),
    ).toBe(true);
    expect(
      analysis.rankedItems.some((item) =>
        item.title.toLowerCase().includes("no active bill pressure"),
      ),
    ).toBe(true);
  });

  it("flags category concentration only when there is meaningful clustering", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "rent",
        name: "Rent",
        category: "Rent / Housing",
        dueDate: getOffsetDateString(2),
        amount: 1400,
      }),
      createBill({
        id: "storage",
        name: "Storage",
        category: "Rent / Housing",
        dueDate: getOffsetDateString(8),
        amount: 300,
      }),
      createBill({
        id: "internet",
        name: "Internet",
        category: "Utilities",
        dueDate: getOffsetDateString(3),
        amount: 95,
      }),
      createBill({
        id: "groceries",
        name: "Groceries",
        category: "Groceries",
        dueDate: getOffsetDateString(5),
        amount: 120,
      }),
    ], { context: "planning" });

    expect(
      analysis.rankedItems.some(
        (item) => item.recommendationType === "Biggest Category Risk",
      ),
    ).toBe(true);
  });

  it("pushes trend warnings in reporting context when late fees or past due counts worsen", () => {
    const analysis = buildAnalysis(
      [
        createBill({
          id: "old-paid",
          name: "Old Paid Bill",
          category: "Utilities",
          status: "Paid",
          dueDate: getOffsetDateString(-40),
          paidDate: getOffsetDateString(-40),
          amount: 80,
        }),
        createBill({
          id: "current-past-due",
          name: "Current Past Due",
          category: "Debt",
          status: "Past Due",
          dueDate: getOffsetDateString(-2),
          amount: 320,
          lateFeeAmount: 25,
        }),
      ],
      { startingBalance: 1200, context: "reporting" },
    );

    expect(analysis.rankedItems[0]?.category).toBe("Trend Commentary");
    expect(
      analysis.rankedItems.some(
        (item) => item.recommendationType === "Trend Warning",
      ),
    ).toBe(true);
  });

  it("changes top pay-first guidance by strategy mode", () => {
    const bills = [
      createBill({
        id: "small-overdue",
        name: "Small Overdue",
        category: "Debt",
        status: "Past Due",
        dueDate: getOffsetDateString(-5),
        amount: 90,
      }),
      createBill({
        id: "large-overdue",
        name: "Large Overdue",
        category: "Debt",
        status: "Past Due",
        dueDate: getOffsetDateString(-5),
        amount: 620,
        lateFeeAmount: 30,
      }),
      createBill({
        id: "rent",
        name: "Rent",
        category: "Rent / Housing",
        dueDate: getOffsetDateString(2),
        amount: 1100,
      }),
    ];

    const snowball = buildAnalysis(bills, { strategy: "snowball", context: "planning", startingBalance: 2200 });
    const avalanche = buildAnalysis(bills, { strategy: "avalanche", context: "planning", startingBalance: 2200 });

    const snowballPayFirst = snowball.rankedItems.find(
      (item) => item.recommendationType === "Pay First",
    );
    const avalanchePayFirst = avalanche.rankedItems.find(
      (item) => item.recommendationType === "Pay First",
    );

    expect(snowballPayFirst?.title).toContain("Small Overdue");
    expect(avalanchePayFirst?.title).toContain("Large Overdue");
  });

  it("prefers essential stability over discretionary urgency in protect-essentials mode", () => {
    const analysis = buildAnalysis(
      [
        createBill({
          id: "power",
          name: "Power Utility",
          category: "Utilities",
          dueDate: getOffsetDateString(2),
          amount: 180,
        }),
        createBill({
          id: "streaming-pack",
          name: "Streaming Pack",
          category: "Subscription",
          dueDate: getOffsetDateString(1),
          amount: 260,
        }),
        createBill({
          id: "member-club",
          name: "Member Club",
          category: "Services",
          dueDate: getOffsetDateString(2),
          amount: 145,
        }),
        createBill({
          id: "rent",
          name: "Rent",
          category: "Rent / Housing",
          dueDate: getOffsetDateString(8),
          amount: 820,
        }),
      ],
      { strategy: "protect-essentials", context: "planning", startingBalance: 1550 },
    );

    const payFirst = analysis.rankedItems.find(
      (item) => item.recommendationType === "Pay First",
    );
    expect(payFirst?.title).toContain("Power Utility");
    expect(payFirst?.strategyInfluence).toContain("essential");
  });

  it("lets fee-heavy pressure outrank smaller non-fee conflicts under minimize-late-fees mode", () => {
    const analysis = buildAnalysis(
      [
        createBill({
          id: "small-overdue",
          name: "Small Overdue",
          category: "Debt",
          status: "Past Due",
          dueDate: getOffsetDateString(-4),
          amount: 95,
        }),
        createBill({
          id: "fee-bill",
          name: "Fee Bearing Bill",
          category: "Debt",
          dueDate: getOffsetDateString(1),
          amount: 220,
          lateFeeAmount: 40,
        }),
        createBill({
          id: "internet",
          name: "Internet",
          category: "Utilities",
          dueDate: getOffsetDateString(4),
          amount: 80,
        }),
        createBill({
          id: "insurance",
          name: "Insurance",
          category: "Insurance",
          dueDate: getOffsetDateString(6),
          amount: 140,
        }),
      ],
      { strategy: "minimize-late-fees", context: "planning", startingBalance: 1400 },
    );

    const feeFocusedItem = analysis.rankedItems.find(
      (item) =>
        item.title.includes("Fee Bearing Bill") ||
        item.recommendation.includes("Fee Bearing Bill") ||
        item.recommendationType === "Prevent Fee Risk",
    );
    expect(feeFocusedItem).toBeDefined();
    expect(feeFocusedItem?.rankingReason || feeFocusedItem?.strategyInfluence).toBeTruthy();
  });

  it("builds what-if scenarios with projected outcomes", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "overdue-1",
        name: "Overdue One",
        category: "Debt",
        status: "Past Due",
        dueDate: getOffsetDateString(-6),
        amount: 180,
        lateFeeAmount: 20,
      }),
      createBill({
        id: "overdue-2",
        name: "Overdue Two",
        category: "Utilities",
        status: "Past Due",
        dueDate: getOffsetDateString(-3),
        amount: 90,
      }),
      createBill({
        id: "next",
        name: "Next Bill",
        category: "Insurance",
        status: "Upcoming",
        dueDate: getOffsetDateString(3),
        amount: 150,
      }),
    ]);

    expect(analysis.scenarios.length).toBeGreaterThan(0);
    expect(analysis.scenarios[0]?.projectedBalanceLeft).toBeTypeOf("number");
    expect(analysis.scenarios.some((scenario) => scenario.type === "clear-all-past-due")).toBe(true);
  });

  it("adds explicit safest scenario tradeoff guidance when cash protection conflicts with cleanup", () => {
    const analysis = buildAnalysis(
      [
        createBill({
          id: "car-loan",
          name: "Car Loan",
          category: "Debt",
          status: "Past Due",
          dueDate: getOffsetDateString(-7),
          amount: 410,
          lateFeeAmount: 35,
        }),
        createBill({
          id: "phone",
          name: "Phone",
          category: "Services",
          status: "Past Due",
          dueDate: getOffsetDateString(-3),
          amount: 95,
        }),
        createBill({
          id: "power",
          name: "Power",
          category: "Utilities",
          dueDate: getOffsetDateString(2),
          amount: 160,
        }),
        createBill({
          id: "insurance",
          name: "Insurance",
          category: "Insurance",
          dueDate: getOffsetDateString(4),
          amount: 180,
        }),
      ],
      { strategy: "preserve-cash-buffer", context: "planning", startingBalance: 560, minimumCashBuffer: 180 },
    );

    const safest = analysis.scenarios.find((scenario) => scenario.priority === "Safest");
    expect(safest).toBeDefined();
    expect(safest?.rankingReason).toContain("safest");
    expect(analysis.scenarios.some((scenario) => Boolean(scenario.tradeoffSummary))).toBe(true);
  });

  it("includes a defensive wait scenario when near-term bills would worsen", () => {
    const analysis = buildAnalysis([
      createBill({ id: "a", name: "Rent", category: "Rent / Housing", dueDate: getOffsetDateString(1), amount: 900 }),
      createBill({ id: "b", name: "Power", category: "Utilities", dueDate: getOffsetDateString(3), amount: 140 }),
      createBill({ id: "c", name: "Insurance", category: "Insurance", dueDate: getOffsetDateString(4), amount: 115 }),
      createBill({ id: "d", name: "Internet", category: "Services", dueDate: getOffsetDateString(5), amount: 65 }),
    ]);

    const waitScenario = analysis.scenarios.find((scenario) => scenario.type === "wait-7-days");
    expect(waitScenario).toBeDefined();
    expect(waitScenario?.priority).toBe("Defensive");
    expect(waitScenario?.riskNote).toContain("late fees");
  });

  it("softens certainty under weak data quality", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "other-1",
        name: "Misc One",
        category: "Other",
        dueDate: getOffsetDateString(4),
        amount: 50,
      }),
      createBill({
        id: "other-2",
        name: "Misc Two",
        category: "Other",
        dueDate: getOffsetDateString(7),
        amount: 60,
      }),
      createBill({
        id: "paid-missing-date",
        name: "Old Bill",
        category: "Other",
        status: "Paid",
        dueDate: getOffsetDateString(-14),
        amount: 40,
      }),
    ]);

    expect(analysis.trust.dataQuality.level).not.toBe("Strong");
    expect(analysis.trust.dataQuality.issues.length).toBeGreaterThan(0);
    expect(analysis.rankedItems.every((item) => item.confidence !== "High")).toBe(
      true,
    );
  });

  it("keeps sparse-data output intentionally small and explicit about limitations", () => {
    const analysis = buildAnalysis([
      createBill({
        id: "one",
        name: "Single Bill",
        category: "Other",
        dueDate: getOffsetDateString(3),
        amount: 70,
      }),
      createBill({
        id: "paid-old",
        name: "Paid Old",
        category: "Other",
        status: "Paid",
        dueDate: getOffsetDateString(-10),
        amount: 40,
      }),
    ]);

    expect(analysis.trust.dataQuality.level).toBe("Sparse");
    expect(analysis.rankedItems.length).toBeLessThanOrEqual(2);
    expect(analysis.scenarios.length).toBeLessThanOrEqual(2);
    expect(analysis.trust.limitationSummary).toBeTruthy();
  });

  it("adds tracking-aware outcome commentary when advisor-led actions improve pressure", () => {
    const tracking: AdvisorTrackingEvent[] = [
      {
        id: "track-1",
        type: "follow-recommendation",
        timestamp: Date.now() - 10_000,
        context: "planning",
        strategy: "reduce-overdue-count",
        sourceId: "priority-alert-past-due",
        sourceLabel: "Past-due bills need immediate attention",
        snapshot: {
          balanceLeft: 320,
          negativeAmount: 0,
          pastDueCount: 3,
          unpaidTotal: 1180,
          totalLateFees: 65,
          dueIn7DaysCount: 2,
          dueIn7DaysTotal: 320,
        },
      },
    ];

    const analysis = buildAnalysis(
      [
        createBill({ id: "overdue-1", name: "Overdue One", category: "Debt", status: "Past Due", dueDate: getOffsetDateString(-3), amount: 180 }),
        createBill({ id: "next", name: "Next Bill", category: "Utilities", dueDate: getOffsetDateString(4), amount: 90 }),
      ],
      { tracking },
    );

    expect(analysis.trust.tracking.note).toContain("Past-due count is down");
  });

  it("surfaces repeated-guidance awareness when the same exposure keeps reappearing", () => {
    const now = Date.now();
    const tracking: AdvisorTrackingEvent[] = Array.from({ length: 4 }, (_, index) => ({
      id: `analysis-${index}`,
      type: "analysis-run",
      timestamp: now - index * 10_000,
      context: "planning",
      strategy: "reduce-overdue-count",
      shownRecommendationIds: ["watch-next-main", "protect-essentials"],
      shownRecommendationTypes: ["Watch Next", "Protect Essentials"],
      shownFocusBillIds: ["bill-main"],
      shownFocusCategories: ["Utilities"],
      shownScenarioTypes: ["wait-7-days"],
      dataQualityLevel: "Moderate",
      snapshot: {
        balanceLeft: 420,
        negativeAmount: 0,
        pastDueCount: 0,
        unpaidTotal: 540,
        totalLateFees: 0,
        dueIn7DaysCount: 2,
        dueIn7DaysTotal: 220,
      },
    }));

    const analysis = buildAnalysis(
      [
        createBill({ id: "bill-main", name: "Main Utility", category: "Utilities", dueDate: getOffsetDateString(2), amount: 140 }),
        createBill({ id: "bill-two", name: "Groceries", category: "Groceries", dueDate: getOffsetDateString(3), amount: 80 }),
        createBill({ id: "bill-three", name: "Insurance", category: "Insurance", dueDate: getOffsetDateString(6), amount: 120 }),
        createBill({ id: "bill-four", name: "Streaming", category: "Subscription", dueDate: getOffsetDateString(5), amount: 22 }),
      ],
      { context: "planning", tracking },
    );

    expect(analysis.trust.tracking.analysisRunCount).toBe(4);
    expect(analysis.trust.tracking.recentRepeatExposureCount).toBeGreaterThanOrEqual(3);
    expect(analysis.trust.tracking.note).toContain("repeated similar guidance");
  });

  it("keeps recommendation output diverse across type and bill focus when multiple valid options exist", () => {
    const analysis = buildAnalysis(
      [
        createBill({
          id: "car-loan",
          name: "Car Loan",
          category: "Debt",
          status: "Past Due",
          dueDate: getOffsetDateString(-5),
          amount: 280,
          lateFeeAmount: 22,
        }),
        createBill({
          id: "credit-line",
          name: "Credit Line",
          category: "Debt",
          dueDate: getOffsetDateString(2),
          amount: 205,
          lateFeeAmount: 15,
        }),
        createBill({
          id: "rent",
          name: "Rent",
          category: "Rent / Housing",
          dueDate: getOffsetDateString(1),
          amount: 940,
        }),
        createBill({
          id: "power",
          name: "Power",
          category: "Utilities",
          dueDate: getOffsetDateString(2),
          amount: 180,
        }),
        createBill({
          id: "insurance",
          name: "Insurance",
          category: "Insurance",
          dueDate: getOffsetDateString(4),
          amount: 210,
        }),
      ],
      { context: "planning", startingBalance: 1150 },
    );

    const recommendationTypes = analysis.rankedItems.map(
      (item) => item.recommendationType,
    );
    const focusedBillIds = analysis.rankedItems
      .map((item) => item.focusBillId)
      .filter((value): value is string => typeof value === "string");

    expect(new Set(recommendationTypes).size).toBe(recommendationTypes.length);
    expect(new Set(focusedBillIds).size).toBe(focusedBillIds.length);
  });

  it("keeps the legacy buildAdvisorItems wrapper returning the ranked items list", () => {
    const bills = [
      createBill({ id: "car-loan", name: "Car Loan", category: "Debt", status: "Past Due", dueDate: getOffsetDateString(-2), amount: 220 }),
      createBill({ id: "internet", name: "Internet", category: "Utilities", dueDate: getOffsetDateString(2), amount: 65 }),
    ];

    const items = buildAdvisorItems({
      version: ADVISOR_FACTS_VERSION,
      context: "overview",
      reportingRange: "month",
      startingBalance: 1000,
      source: {
        kind: "supabase",
        userId: "test-user",
        debtAccounts: [],
        debtSnapshot: {
          summary: {
            totalDebtBalance: 0,
            activeAccountCount: 0,
            delinquentAccountCount: 0,
            lateAccountCount: 0,
            noPaymentRequiredCount: 0,
            activeHardshipCount: 0,
            failedPaymentCount: 0,
            collectionsCount: 0,
            amountNeededToCureTotal: 0,
            requiredPaymentsIn14Days: 0,
            requiredPaymentsIn30Days: 0,
            requiredPaymentsIn60Days: 0,
            minimumCashNeededIn14Days: 0,
            minimumCashNeededIn30Days: 0,
            minimumCashNeededIn60Days: 0,
            totalMinimumDueIn60Days: 0,
            nextDebtDueAmount: 0,
            timingClusterCount: 0,
          },
          accountFacts: [],
          nearTermObligations: [],
          confidenceSummary: {
            Exact: 0,
            Estimated: 0,
            Limited: 0,
            Custom: 0,
            Manual: 0,
          },
          flaggedAccountCount: 0,
          consequenceAccountCount: 0,
          limitedConfidenceAccountCount: 0,
          lifecycleAlertCount: 0,
          boundedOperationalWindowDays: 60,
        },
      },
      bills,
      summary: calculateSummary(bills, 1000, false),
      reporting: calculateReportingSnapshot(bills, "month"),
      includePaidInTotals: false,
      preference: {
        strategy: "reduce-overdue-count",
        minimumCashBuffer: 200,
      },
      tracking: [],
    });

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.id).toBeTruthy();
  });

  it("carries debt-owned trust caveats forward without recalculating them", () => {
    const bills = [
      createBill({ id: "loan", name: "Loan", category: "Debt", dueDate: getOffsetDateString(3), amount: 220 }),
    ];

    const analysis = buildAdvisorAnalysis({
      version: ADVISOR_FACTS_VERSION,
      context: "overview",
      reportingRange: "month",
      startingBalance: 1000,
      source: {
        kind: "supabase",
        userId: "test-user",
        debtAccounts: [],
        debtSnapshot: {
          summary: {
            totalDebtBalance: 4200,
            activeAccountCount: 1,
            delinquentAccountCount: 0,
            lateAccountCount: 1,
            noPaymentRequiredCount: 0,
            activeHardshipCount: 0,
            failedPaymentCount: 0,
            collectionsCount: 0,
            amountNeededToCureTotal: 180,
            requiredPaymentsIn14Days: 180,
            requiredPaymentsIn30Days: 180,
            requiredPaymentsIn60Days: 180,
            minimumCashNeededIn14Days: 180,
            minimumCashNeededIn30Days: 180,
            minimumCashNeededIn60Days: 180,
            totalMinimumDueIn60Days: 180,
            nextDebtDueAmount: 180,
            timingClusterCount: 0,
          },
          accountFacts: [
            {
              accountId: "debt-1",
              providerName: "Student Loan",
              debtType: "Student Loan",
              balance: 4200,
              minimumDue: 180,
              cureAmount: 180,
              standingState: "late",
              standingExplanation: "Late by Debt rules.",
              activeOverlays: [],
              arrangementOverlayLabels: [],
              amountNeededToCure: 180,
              daysPastDue: 6,
              failedPaymentCount: 0,
              reversedPaymentCount: 0,
              lifecycleState: "Active",
              paymentRequirement: "Payment Required",
              interestAccrual: "Interest Accruing",
              currentBalance: 4200,
              trustState: "Limited",
              sourceQuality: "manual_confirmed",
              nextScheduledPaymentAmount: 180,
              nextScheduledPaymentTrustState: "Limited",
              promoActive: false,
              deferredInterest: false,
              payoffTrustState: "Limited",
              projectedRemainingInterestTrustState: "Limited",
              paymentAssumption: {
                label: "Scheduled Payment",
                trustState: "Limited",
                detail: "Manual read only.",
              },
              cashWindows: [],
              factualFlags: [],
              consequences: [],
              extraPaymentImpact: [],
              linkedSchedule: {
                billCount: 1,
                boundedWindowDays: 60,
                editableInBills: false,
                owner: "Debt",
                boundaryNote: "Debt owns the schedule.",
              },
              eventTimeline: [],
              sourceConflicts: [
                {
                  id: "conflict-1",
                  type: "payment-status-conflict",
                  summary: "Debt and statement disagree on status.",
                  detail: "Verification pending.",
                  severity: "warning",
                  requiresConfirmation: true,
                },
              ],
              sourceConflict: true,
              requiresVerification: true,
              isStale: false,
              sourceQualitySummary: "Manual confirmation available.",
              primaryConfidenceState: "Limited",
              primaryConfidenceDetail: "Debt trust is limited.",
            },
          ],
          nearTermObligations: [],
          confidenceSummary: {
            Exact: 0,
            Estimated: 0,
            Limited: 1,
            Custom: 0,
            Manual: 0,
          },
          flaggedAccountCount: 0,
          consequenceAccountCount: 0,
          limitedConfidenceAccountCount: 1,
          lifecycleAlertCount: 1,
          boundedOperationalWindowDays: 60,
        },
      },
      bills,
      summary: calculateSummary(bills, 1000, false),
      reporting: calculateReportingSnapshot(bills, "month"),
      includePaidInTotals: false,
      preference: {
        strategy: "reduce-overdue-count",
        minimumCashBuffer: 200,
      },
      tracking: [],
    });

    expect(analysis.trust.explainability).toContain("Debt-owned lifecycle");
    expect(analysis.trust.signalsUsed.join(" ")).toContain("Debt reports");
    expect(analysis.trust.limitationSummary).toContain("source conflict");
  });

  it("downgrades debt language across non-exact trust states without introducing scoring tone", () => {
    const bills = [createBill({ id: "bill-1", category: "Debt", amount: 120, status: "Past Due" })];
    const analysis = buildAdvisorAnalysis({
      version: ADVISOR_FACTS_VERSION,
      context: "overview",
      reportingRange: "month",
      startingBalance: 1000,
      includePaidInTotals: false,
      source: {
        kind: "supabase",
        userId: "test-user",
        debtAccounts: [],
        debtSnapshot: {
          summary: {
            totalDebtBalance: 2100,
            activeAccountCount: 4,
            delinquentAccountCount: 1,
            lateAccountCount: 1,
            noPaymentRequiredCount: 0,
            activeHardshipCount: 0,
            failedPaymentCount: 0,
            collectionsCount: 0,
            amountNeededToCureTotal: 180,
            requiredPaymentsIn14Days: 0,
            requiredPaymentsIn30Days: 0,
            requiredPaymentsIn60Days: 0,
            minimumCashNeededIn14Days: 0,
            minimumCashNeededIn30Days: 0,
            minimumCashNeededIn60Days: 0,
            totalMinimumDueIn60Days: 0,
            nextDebtDueAmount: 0,
            timingClusterCount: 0,
          },
          accountFacts: [
            {
              accountId: "est",
              providerName: "Estimate Card",
              debtType: "Credit Card",
              balance: 500,
              minimumDue: 50,
              cureAmount: 0,
              standingState: "current",
              standingExplanation: "Current.",
              activeOverlays: [],
              arrangementOverlayLabels: [],
              amountNeededToCure: 0,
              daysPastDue: 0,
              failedPaymentCount: 0,
              reversedPaymentCount: 0,
              lifecycleState: "Active",
              paymentRequirement: "Payment Required",
              interestAccrual: "Interest Accruing",
              currentBalance: 500,
              trustState: "Estimated",
              sourceQuality: "user_entered",
              nextScheduledPaymentAmount: 50,
              nextScheduledPaymentTrustState: "Estimated",
              promoActive: false,
              deferredInterest: false,
              payoffTrustState: "Estimated",
              projectedRemainingInterestTrustState: "Estimated",
              paymentAssumption: { label: "Estimated", trustState: "Estimated", detail: "Estimated." },
              cashWindows: [],
              factualFlags: [],
              consequences: [],
              extraPaymentImpact: [],
              linkedSchedule: { billCount: 0, boundedWindowDays: 60, editableInBills: false, owner: "Debt", boundaryNote: "Debt owns the schedule." },
              eventTimeline: [],
              sourceConflicts: [],
              sourceConflict: false,
              requiresVerification: false,
              isStale: false,
              sourceQualitySummary: "Estimated.",
              primaryConfidenceState: "Estimated",
              primaryConfidenceDetail: "Estimated.",
            },
            {
              accountId: "custom",
              providerName: "Custom Loan",
              debtType: "Auto Loan",
              balance: 600,
              minimumDue: 60,
              cureAmount: 0,
              standingState: "late",
              standingExplanation: "Late.",
              activeOverlays: [],
              arrangementOverlayLabels: [],
              amountNeededToCure: 0,
              daysPastDue: 0,
              failedPaymentCount: 0,
              reversedPaymentCount: 0,
              lifecycleState: "Active",
              paymentRequirement: "Payment Required",
              interestAccrual: "Interest Accruing",
              currentBalance: 600,
              trustState: "Custom",
              sourceQuality: "manual_confirmed",
              nextScheduledPaymentAmount: 60,
              nextScheduledPaymentTrustState: "Custom",
              promoActive: false,
              deferredInterest: false,
              payoffTrustState: "Custom",
              projectedRemainingInterestTrustState: "Custom",
              paymentAssumption: { label: "Custom", trustState: "Custom", detail: "Custom." },
              cashWindows: [],
              factualFlags: [],
              consequences: [],
              extraPaymentImpact: [],
              linkedSchedule: { billCount: 0, boundedWindowDays: 60, editableInBills: false, owner: "Debt", boundaryNote: "Debt owns the schedule." },
              eventTimeline: [],
              sourceConflicts: [],
              sourceConflict: false,
              requiresVerification: false,
              isStale: false,
              sourceQualitySummary: "Custom.",
              primaryConfidenceState: "Custom",
              primaryConfidenceDetail: "Custom.",
            },
            {
              accountId: "manual",
              providerName: "Manual Loan",
              debtType: "Student Loan",
              balance: 400,
              minimumDue: 40,
              cureAmount: 0,
              standingState: "current",
              standingExplanation: "Current.",
              activeOverlays: [],
              arrangementOverlayLabels: [],
              amountNeededToCure: 0,
              daysPastDue: 0,
              failedPaymentCount: 0,
              reversedPaymentCount: 0,
              lifecycleState: "Active",
              paymentRequirement: "Payment Required",
              interestAccrual: "Interest Accruing",
              currentBalance: 400,
              trustState: "Manual",
              sourceQuality: "manual_confirmed",
              nextScheduledPaymentAmount: 40,
              nextScheduledPaymentTrustState: "Manual",
              promoActive: false,
              deferredInterest: false,
              payoffTrustState: "Manual",
              projectedRemainingInterestTrustState: "Manual",
              paymentAssumption: { label: "Manual", trustState: "Manual", detail: "Manual." },
              cashWindows: [],
              factualFlags: [],
              consequences: [],
              extraPaymentImpact: [],
              linkedSchedule: { billCount: 0, boundedWindowDays: 60, editableInBills: false, owner: "Debt", boundaryNote: "Debt owns the schedule." },
              eventTimeline: [],
              sourceConflicts: [],
              sourceConflict: false,
              requiresVerification: false,
              isStale: false,
              sourceQualitySummary: "Manual.",
              primaryConfidenceState: "Manual",
              primaryConfidenceDetail: "Manual.",
            },
            {
              accountId: "stale",
              providerName: "Stale Card",
              debtType: "Credit Card",
              balance: 600,
              minimumDue: 30,
              cureAmount: 0,
              standingState: "current",
              standingExplanation: "Current.",
              activeOverlays: [],
              arrangementOverlayLabels: [],
              amountNeededToCure: 0,
              daysPastDue: 0,
              failedPaymentCount: 0,
              reversedPaymentCount: 0,
              lifecycleState: "Active",
              paymentRequirement: "Payment Required",
              interestAccrual: "Interest Accruing",
              currentBalance: 600,
              trustState: "Stale",
              sourceQuality: "user_entered",
              nextScheduledPaymentAmount: 30,
              nextScheduledPaymentTrustState: "Limited",
              promoActive: false,
              deferredInterest: false,
              payoffTrustState: "Limited",
              projectedRemainingInterestTrustState: "Limited",
              paymentAssumption: { label: "Stale", trustState: "Limited", detail: "Stale." },
              cashWindows: [],
              factualFlags: [],
              consequences: [],
              extraPaymentImpact: [],
              linkedSchedule: { billCount: 0, boundedWindowDays: 60, editableInBills: false, owner: "Debt", boundaryNote: "Debt owns the schedule." },
              eventTimeline: [],
              sourceConflicts: [],
              sourceConflict: false,
              requiresVerification: true,
              isStale: true,
              sourceQualitySummary: "Stale.",
              primaryConfidenceState: "Limited",
              primaryConfidenceDetail: "Stale.",
            },
          ],
          nearTermObligations: [],
          confidenceSummary: {
            Exact: 0,
            Estimated: 1,
            Limited: 1,
            Custom: 1,
            Manual: 1,
          },
          flaggedAccountCount: 0,
          consequenceAccountCount: 0,
          limitedConfidenceAccountCount: 1,
          lifecycleAlertCount: 0,
          boundedOperationalWindowDays: 60,
        },
      },
      bills,
      summary: calculateSummary(bills, 1000, false),
      reporting: calculateReportingSnapshot(bills, "month"),
      preference: { strategy: "reduce-overdue-count", minimumCashBuffer: 200 },
      tracking: [],
    });

    const trustText = analysis.trust.signalsUsed.join(" ");
    expect(trustText).toContain("estimated");
    expect(trustText).toContain("custom");
    expect(trustText).toContain("manual");
    expect(trustText).toContain("stale");
    expect(analysis.trust.explainability).toContain("evaluates overdue status");
    expect(analysis.trust.explainability).not.toContain("ranks overdue status");
  });
});
