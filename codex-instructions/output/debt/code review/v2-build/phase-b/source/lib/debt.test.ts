import { describe, expect, it } from "vitest";
import { calculateDebtDerivedMetrics } from "@/lib/debt";
import type { DebtAccount } from "@/lib/types";

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
});
