"use client";

import { Icon } from "@iconify/react";
import { useMemo, useState } from "react";
import type { DebtType } from "@/lib/types";
import {
  DEBT_IDENTITY_COLOR_OPTIONS,
  DEBT_PROVIDER_LOGO_REGISTRY,
  searchDebtIconOptions,
  suggestDebtProviderKey,
  type DebtAccountIdentityMode,
} from "@/lib/debt-identity";
import { DebtAccountIdentityFrame } from "@/components/DebtAccountIdentityFrame";

type DebtAccountIdentityEditorProps = {
  debtType: DebtType;
  providerName: string;
  issuerName: string;
  identityMode: DebtAccountIdentityMode;
  providerKey: string;
  iconKey: string;
  accentColor: string;
  displayLabel: string;
  customImageAssetId: string;
  onChange: (
    patch: Partial<{
      identityMode: DebtAccountIdentityMode;
      providerKey: string;
      iconKey: string;
      accentColor: string;
      displayLabel: string;
      customImageAssetId: string;
    }>,
  ) => void;
};

export function DebtAccountIdentityEditor({
  debtType,
  providerName,
  issuerName,
  identityMode,
  providerKey,
  iconKey,
  accentColor,
  displayLabel,
  customImageAssetId,
  onChange,
}: DebtAccountIdentityEditorProps) {
  const [iconQuery, setIconQuery] = useState("");
  const suggestedProviderKey = suggestDebtProviderKey(providerName, issuerName);
  const iconOptions = useMemo(
    () => searchDebtIconOptions(iconQuery, debtType).slice(0, 12),
    [debtType, iconQuery],
  );

  const effectiveProviderKey = providerKey || suggestedProviderKey || "";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Account Identity</p>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Keep identity optional. Use a local provider logo when it matches cleanly, or switch to a searchable icon if you want a simpler visual marker.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <DebtAccountIdentityFrame
            debtType={debtType}
            identityMode={identityMode}
            providerKey={effectiveProviderKey}
            providerName={providerName}
            issuerName={issuerName}
            iconKey={iconKey}
            accentColor={accentColor}
            customImageAssetId={customImageAssetId}
            size="lg"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Live preview</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{displayLabel.trim() || providerName || debtType}</p>
            <p className="mt-0.5 text-xs text-slate-600">{identityMode === "provider_logo" ? "Provider logo" : identityMode === "custom_icon" ? "Custom icon" : "Default type icon"}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange({ identityMode: "none" })}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                identityMode === "none"
                  ? "border-blue-300 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Use default
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  identityMode: "provider_logo",
                  providerKey: effectiveProviderKey,
                })
              }
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                identityMode === "provider_logo"
                  ? "border-blue-300 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Use provider logo
            </button>
            <button
              type="button"
              onClick={() => onChange({ identityMode: "custom_icon" })}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                identityMode === "custom_icon"
                  ? "border-blue-300 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              Use custom icon
            </button>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Display label</span>
            <input
              type="text"
              value={displayLabel}
              onChange={(event) => onChange({ displayLabel: event.target.value })}
              className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
              placeholder="Optional nickname for this account"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Accent color</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(event) => onChange({ accentColor: event.target.value })}
                className="h-11 w-14 rounded-xl border border-slate-300 bg-white p-1"
                aria-label="Select identity accent color"
              />
              {DEBT_IDENTITY_COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ accentColor: color })}
                  className={`h-8 w-8 rounded-full border ${accentColor === color ? "border-slate-900" : "border-slate-300"}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Use ${color} accent`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {identityMode === "provider_logo" ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Provider logo</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Local provider logos are preferred when the account name matches a known registry entry. Unknown providers fall back cleanly to icon mode.
                </p>
              </div>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Provider registry match</span>
                <select
                  value={effectiveProviderKey}
                  onChange={(event) => onChange({ providerKey: event.target.value })}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  <option value="">Select provider logo</option>
                  {DEBT_PROVIDER_LOGO_REGISTRY.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.label}
                      {entry.key === suggestedProviderKey ? " (suggested)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : identityMode === "custom_icon" ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Icon picker</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Search a small local icon set and keep the identity frame consistent across list rows, details, and review surfaces.
                </p>
              </div>
              <input
                type="search"
                value={iconQuery}
                onChange={(event) => setIconQuery(event.target.value)}
                className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                placeholder="Search icons"
              />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {iconOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onChange({ iconKey: option.key })}
                    className={`rounded-2xl border bg-white px-2 py-2 text-left transition ${
                      option.key === iconKey
                        ? "border-blue-300 ring-2 ring-blue-200"
                        : "border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                      <Icon icon={option.icon} className="h-5 w-5" />
                    </span>
                    <span className="mt-2 block text-xs font-semibold text-slate-800">{option.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Default identity</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                If you skip identity selection, Debt will keep using a calm default icon based on debt type. You can refine it later in account editing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
