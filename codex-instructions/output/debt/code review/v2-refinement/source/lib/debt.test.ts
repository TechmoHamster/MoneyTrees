import { describe, expect, it } from "vitest";
import {
  buildDebtDownstreamSnapshot,
  calculateDebtDerivedMetrics,
  calculateDebtSummary,
} from "@/lib/debt";
import type { Bill, DebtAccount } from "@/lib/types";

function createDebtAccount(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: "debt-1",
    providerName: "Test Debt",
    debtType: "Auto Loan",
    currentBalance: 1000,
    paymentCadence: "Monthly",
    nextDueDate: "2026-04-15",
    minimumPayment: 200,
    scheduledPaymentAmount: 200,
    lifecycleState: "Active",
    paymentRequirement: "Payment Required",
    interestAccrual: "No Interest Accruing",
    ...overrides,
  };
}

function createDebtBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    name: "Debt Payment",
    category: "Debt",
    status: "Upcoming",
    dueDate: "2026-04-15",
    amount: 200,
    sourceType: "debt-derived",
    sourceDebtAccountId: "debt-1",
    ...overrides,
  };
}

describe("calculateDebtDerivedMetrics", () => {
  it("builds exact payoff outputs for fixed no-interest debt", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        termLengthMonths: 5,
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBe("2026-08-15");
    expect(metrics.payoffTrustState).toBe("Exact");
    expect(metrics.paymentAmountTrustState).toBe("Exact");
    expect(metrics.projectedRemainingInterest).toBe(0);
    expect(metrics.projectedRemainingInterestTrustState).toBe("Exact");
    expect(metrics.projection.methodLabel).toBe("Fixed payment schedule");
    expect(metrics.projection.scenarios).toHaveLength(3);
    expect(metrics.projection.scenarios[0]).toMatchObject({
      label: "+$50",
      trustState: "Exact",
      payoffDate: "2026-07-15",
      monthsSaved: 1,
      projectedInterestSaved: 0,
    });
  });

  it("keeps no-interest payoff trust manual when payment is user-entered without installment support", () => {
    const metrics = calculateDebtDerivedMetrics(createDebtAccount(), []);

    expect(metrics.paymentAmountTrustState).toBe("Manual");
    expect(metrics.payoffTrustState).toBe("Manual");
    expect(metrics.projection.scenarios[0]?.trustState).toBe("Manual");
    expect(metrics.trustNotes).toContain(
      "Projection uses a manually entered recurring payment amount without full amortization support.",
    );
  });

  it("marks custom scheduled-payment overrides as custom instead of flattening them", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        termLengthMonths: 6,
        minimumPayment: 150,
        scheduledPaymentAmount: 225,
      }),
      [],
    );

    expect(metrics.paymentAmountTrustState).toBe("Custom");
    expect(metrics.payoffTrustState).toBe("Custom");
    expect(metrics.projection.scenarios[1]?.trustState).toBe("Custom");
    expect(metrics.trustNotes).toContain(
      "Projection uses a custom recurring payment instead of the baseline minimum payment.",
    );
  });

  it("builds estimated payoff and interest outputs for APR-based debt", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        currentBalance: 1200,
        minimumPayment: 110,
        scheduledPaymentAmount: 110,
        termLengthMonths: 12,
        apr: 12,
        interestAccrual: "Interest Accruing",
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBeDefined();
    expect(metrics.payoffTrustState).toBe("Estimated");
    expect(metrics.paymentAmountTrustState).toBe("Estimated");
    expect(metrics.projectedRemainingInterest).toBeGreaterThan(0);
    expect(metrics.projectedRemainingInterestTrustState).toBe("Estimated");
    expect(metrics.projection.scenarios[0]?.trustState).toBe("Estimated");
    expect(metrics.projection.scenarios[0]?.projectedInterestSaved).toBeGreaterThan(0);
  });

  it("marks projection limited when interest accrues but APR is missing", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        interestAccrual: "Interest Accruing",
        apr: undefined,
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBeUndefined();
    expect(metrics.payoffTrustState).toBe("Limited");
    expect(metrics.projectedRemainingInterest).toBeUndefined();
    expect(metrics.projection.scenarios).toHaveLength(0);
    expect(metrics.projection.limitationNote).toContain("Current inputs are not sufficient");
  });

  it("falls back to installment-count timing when APR is missing but explicit counts exist", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        interestAccrual: "Interest Accruing",
        apr: undefined,
        totalPaymentCount: 24,
        completedPaymentCount: 4,
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBe("2027-11-15");
    expect(metrics.payoffTrustState).toBe("Exact");
    expect(metrics.projection.methodLabel).toBe("Installment count schedule");
    expect(metrics.projection.scenarios).toHaveLength(0);
  });

  it("keeps credit-card payoff projections visible but trust-limited", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        debtType: "Credit Card",
        currentBalance: 900,
        minimumPayment: 80,
        scheduledPaymentAmount: 80,
        apr: 18,
        interestAccrual: "Interest Accruing",
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBeDefined();
    expect(metrics.payoffTrustState).toBe("Limited");
    expect(metrics.paymentAmountTrustState).toBe("Manual");
    expect(metrics.projectedRemainingInterestTrustState).toBe("Limited");
    expect(metrics.projection.scenarios[0]?.trustState).toBe("Limited");
    expect(metrics.projection.limitationNote).toContain(
      "Credit-card projections use the active payment assumption",
    );
  });

  it("handles weekly cadence boundaries without collapsing payoff timing", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        paymentCadence: "Weekly",
        currentBalance: 400,
        minimumPayment: 100,
        scheduledPaymentAmount: 100,
        termLengthMonths: 4,
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBe("2026-05-06");
    expect(metrics.projection.scenarios[0]?.payoffDate).toBe("2026-04-29");
  });

  it("marks invalid due-date input as limited instead of emitting unstable dates", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        nextDueDate: "2026-02-31",
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBeUndefined();
    expect(metrics.payoffTrustState).toBe("Limited");
    expect(metrics.projection.limitationNote).toContain("valid next due date");
    expect(metrics.projection.scenarios).toHaveLength(0);
  });

  it("fails closed when payment is too low to amortize interest", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        currentBalance: 1000,
        minimumPayment: 50,
        scheduledPaymentAmount: 50,
        apr: 100,
        interestAccrual: "Interest Accruing",
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBeUndefined();
    expect(metrics.projection.scenarios).toHaveLength(0);
    expect(metrics.projection.limitationNote).toContain("Current inputs are not sufficient");
  });

  it("keeps longer-tail projections stable when the account can amortize", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        currentBalance: 20000,
        minimumPayment: 250,
        scheduledPaymentAmount: 250,
        apr: 12,
        interestAccrual: "Interest Accruing",
        termLengthMonths: 120,
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBeDefined();
    expect(metrics.projection.scenarios).toHaveLength(3);
    expect(metrics.projectedRemainingInterest).toBeGreaterThan(0);
  });

  it("keeps static projection assumptions explicit and inspectable", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        apr: 9.99,
        interestAccrual: "Interest Accruing",
        termLengthMonths: 12,
      }),
      [],
    );

    expect(metrics.projection.assumptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Behavior stays static",
          note: "This is a static projection. It does not simulate future behavior changes.",
        }),
      ]),
    );
  });

  it("builds 14 / 30 / 60 day debt cash windows and timing-cluster visibility", () => {
    const bills = [
      createDebtBill({
        id: "bill-past-due",
        dueDate: "2026-04-08",
        amount: 120,
        status: "Past Due",
      }),
      createDebtBill({
        id: "bill-1",
        dueDate: "2026-04-15",
        amount: 125,
      }),
      createDebtBill({
        id: "bill-2",
        dueDate: "2026-04-20",
        amount: 140,
      }),
      createDebtBill({
        id: "bill-3",
        dueDate: "2026-05-10",
        amount: 160,
      }),
    ];

    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        pastDueAmount: 180,
      }),
      bills,
    );

    expect(metrics.cashWindows).toHaveLength(3);
    expect(metrics.cashWindows[0]).toMatchObject({
      windowDays: 14,
      requiredPaymentTotal: 265,
      minimumCashNeededToStayCurrent: 445,
      dueCount: 2,
      nextDueDate: "2026-04-15",
    });
    expect(metrics.cashWindows[1]).toMatchObject({
      windowDays: 30,
      requiredPaymentTotal: 425,
      minimumCashNeededToStayCurrent: 605,
      dueCount: 3,
    });
    expect(metrics.cashWindows[2].requiredPaymentTotal).toBe(425);
    expect(metrics.timingCluster?.count).toBe(2);
    expect(metrics.factualFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "Timing Cluster Forming" }),
        expect.objectContaining({ type: "Payment Due Soon" }),
      ]),
    );
  });

  it("surfaces factual flags and consequence visibility for credit-card risk states", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        debtType: "Credit Card",
        currentBalance: 950,
        creditLimit: 1000,
        minimumPayment: 80,
        scheduledPaymentAmount: 80,
        apr: 24,
        interestAccrual: "Interest Accruing",
        statementBalance: 950,
        statementMinimumDue: 80,
        paymentAssumptionMode: "Minimum Due",
        minimumPaymentMode: "Manual Minimum Amount",
        isDelinquent: true,
        pastDueAmount: 120,
        daysPastDue: 45,
        lateFeeAmount: 35,
        promoBalance: 300,
        promoType: "Intro APR",
        promoEndDate: "2026-04-25",
        gracePeriodStatus: "Grace Period Lost",
      }),
      [createDebtBill({ amount: 80 })],
    );

    expect(metrics.factualFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "Delinquent" }),
        expect.objectContaining({ type: "Payment Due Soon" }),
        expect.objectContaining({ type: "Promo Expiring Soon" }),
        expect.objectContaining({ type: "High Utilization" }),
        expect.objectContaining({ type: "Interest Accruing" }),
      ]),
    );
    expect(metrics.consequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "Late Fee Exposure" }),
        expect.objectContaining({ type: "Promo Expiration Risk" }),
        expect.objectContaining({ type: "Loss of Grace Period" }),
        expect.objectContaining({ type: "Increased Interest Burden" }),
        expect.objectContaining({ type: "Delinquency Progression" }),
      ]),
    );
  });

  it("supports no-payment-required and closed-with-balance factual states", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        lifecycleState: "Closed With Balance",
        paymentRequirement: "No Payment Required",
        interestAccrual: "Interest Accruing",
        apr: 9,
      }),
      [],
    );

    expect(metrics.factualFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "No Payment Required" }),
        expect.objectContaining({ type: "Interest Accruing While No Payment Required" }),
        expect.objectContaining({ type: "Closed With Balance" }),
      ]),
    );
    expect(metrics.consequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "Closed Account Balance Still Owed" }),
        expect.objectContaining({ type: "Increased Interest Burden" }),
      ]),
    );
  });

  it("flags missing key inputs when reliability-limiting debt truth is absent", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        debtType: "Credit Card",
        nextDueDate: undefined,
        minimumPayment: undefined,
        scheduledPaymentAmount: undefined,
        apr: undefined,
        interestAccrual: "Interest Accruing",
        promoBalance: 200,
        promoEndDate: undefined,
      }),
      [],
    );

    expect(metrics.factualFlags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "Missing Key Inputs Limiting Reliability",
        }),
      ]),
    );
  });
});

describe("calculateDebtSummary", () => {
  it("aggregates debt cash windows and timing-cluster visibility", () => {
    const accountA = createDebtAccount({
      id: "debt-1",
      providerName: "Card One",
      currentBalance: 600,
      minimumPayment: 100,
      scheduledPaymentAmount: 100,
      pastDueAmount: 50,
    });
    const accountB = createDebtAccount({
      id: "debt-2",
      providerName: "Loan Two",
      currentBalance: 800,
      minimumPayment: 150,
      scheduledPaymentAmount: 150,
      nextDueDate: "2026-04-18",
    });

    const bills = [
      createDebtBill({
        id: "a1",
        sourceDebtAccountId: "debt-1",
        dueDate: "2026-04-15",
        amount: 100,
      }),
      createDebtBill({
        id: "a2",
        sourceDebtAccountId: "debt-1",
        dueDate: "2026-05-10",
        amount: 100,
      }),
      createDebtBill({
        id: "b1",
        sourceDebtAccountId: "debt-2",
        dueDate: "2026-04-18",
        amount: 150,
      }),
    ];

    const summary = calculateDebtSummary([accountA, accountB], bills);

    expect(summary.requiredPaymentsIn14Days).toBe(250);
    expect(summary.requiredPaymentsIn30Days).toBe(350);
    expect(summary.requiredPaymentsIn60Days).toBe(350);
    expect(summary.minimumCashNeededIn14Days).toBe(300);
    expect(summary.minimumCashNeededIn30Days).toBe(400);
    expect(summary.timingClusterCount).toBe(2);
    expect(summary.timingClusterNote).toContain("2 required payments land between");
  });
});

describe("buildDebtDownstreamSnapshot", () => {
  it("builds bounded downstream obligations and structured account facts", () => {
    const account = createDebtAccount({
      id: "debt-1",
      providerName: "Debt One",
      debtType: "Installment Loan",
      currentBalance: 1600,
      minimumPayment: 200,
      scheduledPaymentAmount: 200,
      termLengthMonths: 12,
      interestAccrual: "No Interest Accruing",
      pastDueAmount: 60,
      daysPastDue: 10,
    });

    const bills = [
      createDebtBill({
        id: "near-1",
        sourceDebtAccountId: "debt-1",
        dueDate: "2026-04-15",
        amount: 200,
        status: "Upcoming",
      }),
      createDebtBill({
        id: "near-2",
        sourceDebtAccountId: "debt-1",
        dueDate: "2026-05-10",
        amount: 200,
        status: "Upcoming",
      }),
      createDebtBill({
        id: "past-due-1",
        sourceDebtAccountId: "debt-1",
        dueDate: "2026-04-01",
        amount: 175,
        status: "Past Due",
      }),
      createDebtBill({
        id: "paid-1",
        sourceDebtAccountId: "debt-1",
        dueDate: "2026-04-22",
        amount: 200,
        status: "Paid",
      }),
      createDebtBill({
        id: "far-1",
        sourceDebtAccountId: "debt-1",
        dueDate: "2026-07-20",
        amount: 200,
        status: "Upcoming",
      }),
    ];

    const snapshot = buildDebtDownstreamSnapshot([account], bills);

    expect(snapshot.boundedOperationalWindowDays).toBe(60);
    expect(snapshot.nearTermObligations).toHaveLength(2);
    expect(snapshot.nearTermObligations[0]).toMatchObject({
      billId: "near-1",
      accountId: "debt-1",
      providerName: "Debt One",
      debtType: "Installment Loan",
      dueDate: "2026-04-15",
      amount: 200,
    });
    expect(snapshot.accountFacts).toHaveLength(1);
    expect(snapshot.accountFacts[0]).toMatchObject({
      accountId: "debt-1",
      providerName: "Debt One",
      nextScheduledPaymentAmount: 200,
      payoffTrustState: "Exact",
      primaryConfidenceState: "Exact",
    });
    expect(snapshot.accountFacts[0]?.primaryConfidenceDetail).toContain(
      "aligned payment, payoff, and remaining-interest support",
    );
    expect(snapshot.accountFacts[0]?.paymentAssumption).toMatchObject({
      label: "Scheduled Payment",
      amount: 200,
      trustState: "Exact",
    });
    expect(snapshot.accountFacts[0]?.linkedSchedule).toMatchObject({
      billCount: 2,
      boundedWindowDays: 60,
      editableInBills: false,
      owner: "Debt",
    });
    expect(snapshot.accountFacts[0]?.extraPaymentImpact).toHaveLength(3);
    expect(snapshot.accountFacts[0]?.factualFlags).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "Payment Due Soon" })]),
    );
    expect(snapshot.flaggedAccountCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.confidenceSummary.Exact).toBe(1);
  });

  it("keeps limited-confidence credit-card outputs strict for downstream consumers", () => {
    const account = createDebtAccount({
      id: "card-1",
      providerName: "Card One",
      debtType: "Credit Card",
      currentBalance: 900,
      minimumPayment: 80,
      scheduledPaymentAmount: 80,
      apr: 18,
      interestAccrual: "Interest Accruing",
      statementBalance: 900,
      statementMinimumDue: 80,
      paymentAssumptionMode: "Minimum Due",
      minimumPaymentMode: "Manual Minimum Amount",
    });

    const bills = [
      createDebtBill({
        id: "card-bill-1",
        sourceDebtAccountId: "card-1",
        dueDate: "2026-04-15",
        amount: 80,
      }),
    ];

    const snapshot = buildDebtDownstreamSnapshot([account], bills);
    const fact = snapshot.accountFacts[0];

    expect(fact?.primaryConfidenceState).toBe("Limited");
    expect(fact?.paymentAssumption).toMatchObject({
      label: "Minimum Due",
      amount: 80,
      trustState: "Manual",
    });
    expect(fact?.projectedRemainingInterestTrustState).toBe("Limited");
    expect(fact?.extraPaymentImpact[0]?.trustState).toBe("Limited");
    expect(snapshot.limitedConfidenceAccountCount).toBe(1);
  });

  it("keeps downstream primary confidence limited when reliability gaps weaken otherwise-usable debt truth", () => {
    const snapshot = buildDebtDownstreamSnapshot(
      [
        createDebtAccount({
          id: "card-2",
          providerName: "Card Two",
          debtType: "Credit Card",
          currentBalance: 600,
          minimumPayment: 55,
          scheduledPaymentAmount: 55,
          statementBalance: 600,
          statementMinimumDue: 55,
          apr: 19.99,
          interestAccrual: "Interest Accruing",
          gracePeriodStatus: undefined,
        }),
      ],
      [
        createDebtBill({
          id: "card-2-bill",
          sourceDebtAccountId: "card-2",
          dueDate: "2026-04-20",
          amount: 55,
        }),
      ],
    );

    expect(snapshot.accountFacts[0]?.primaryConfidenceState).toBe("Limited");
    expect(snapshot.accountFacts[0]?.primaryConfidenceDetail).toContain(
      "downstream debt input is still missing",
    );
  });
});
