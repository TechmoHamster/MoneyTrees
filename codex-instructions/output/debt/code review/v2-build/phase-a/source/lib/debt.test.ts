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
    const metrics = calculateDebtDerivedMetrics(createDebtAccount(), []);

    expect(metrics.payoffDateProjection).toBe("2026-08-15");
    expect(metrics.payoffTrustState).toBe("Exact");
    expect(metrics.projectedRemainingInterest).toBe(0);
    expect(metrics.projectedRemainingInterestTrustState).toBe("Exact");
    expect(metrics.projection.methodLabel).toBe("Fixed payment schedule");
    expect(metrics.projection.scenarios).toHaveLength(3);
    expect(metrics.projection.scenarios[0]).toMatchObject({
      label: "+$50",
      trustState: "Custom",
      payoffDate: "2026-07-15",
      monthsSaved: 1,
      projectedInterestSaved: 0,
    });
  });

  it("builds estimated payoff and interest outputs for APR-based debt", () => {
    const metrics = calculateDebtDerivedMetrics(
      createDebtAccount({
        currentBalance: 1200,
        minimumPayment: 110,
        scheduledPaymentAmount: 110,
        apr: 12,
        interestAccrual: "Interest Accruing",
      }),
      [],
    );

    expect(metrics.payoffDateProjection).toBeDefined();
    expect(metrics.payoffTrustState).toBe("Estimated");
    expect(metrics.projectedRemainingInterest).toBeGreaterThan(0);
    expect(metrics.projectedRemainingInterestTrustState).toBe("Estimated");
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
    expect(metrics.projectedRemainingInterestTrustState).toBe("Limited");
    expect(metrics.projection.limitationNote).toContain("Credit card minimum payment rules are not modeled in V2A");
  });
});
