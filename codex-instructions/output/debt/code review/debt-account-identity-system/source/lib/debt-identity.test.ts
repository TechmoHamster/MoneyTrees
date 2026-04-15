import { describe, expect, it } from "vitest";
import {
  getDebtAccountDisplayName,
  getDebtAccountIdentity,
  getDefaultDebtIconKey,
  normalizeDebtIdentityColor,
  searchDebtIconOptions,
  suggestDebtProviderKey,
} from "@/lib/debt-identity";

describe("debt identity helpers", () => {
  it("matches known provider aliases deterministically", () => {
    expect(suggestDebtProviderKey("Chase Sapphire", "Chase")).toBe("chase");
    expect(suggestDebtProviderKey("PayPal Pay Later")).toBe("paypal");
    expect(suggestDebtProviderKey("Unknown Local Credit Union")).toBeUndefined();
  });

  it("normalizes accent colors to 6-digit hex values", () => {
    expect(normalizeDebtIdentityColor("2563EB")).toBe("#2563eb");
    expect(normalizeDebtIdentityColor("#10B981")).toBe("#10b981");
    expect(normalizeDebtIdentityColor("bad-color")).toBeUndefined();
  });

  it("resolves provider-logo mode with fallback icon defaults", () => {
    const resolved = getDebtAccountIdentity({
      debtType: "Credit Card",
      identityMode: "provider_logo",
      providerName: "Chase Sapphire",
      issuerName: "Chase",
      providerKey: "",
      iconKey: "",
      accentColor: "",
      customImageAssetId: "",
    });

    expect(resolved.providerKey).toBe("chase");
    expect(resolved.providerEntry?.label).toBe("Chase");
    expect(resolved.iconKey).toBe(getDefaultDebtIconKey("Credit Card"));
  });

  it("returns searchable icon options with debt-type recommendations first", () => {
    const options = searchDebtIconOptions("car", "Auto Loan");
    expect(options[0]?.key).toBe("lucide:car-front");
  });

  it("prefers display labels when present", () => {
    expect(
      getDebtAccountDisplayName({
        providerName: "Chase Sapphire",
        displayLabel: "Travel Card",
      }),
    ).toBe("Travel Card");
  });
});
