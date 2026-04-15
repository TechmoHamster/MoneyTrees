"use client";

import { Icon } from "@iconify/react";
import { ImageIcon } from "lucide-react";
import type { DebtType } from "@/lib/types";
import {
  type DebtAccountIdentityMode,
  getDebtAccountIdentity,
} from "@/lib/debt-identity";

type DebtAccountIdentityFrameProps = {
  debtType: DebtType;
  identityMode?: DebtAccountIdentityMode;
  providerKey?: string;
  providerName?: string;
  issuerName?: string;
  iconKey?: string;
  accentColor?: string;
  customImageAssetId?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-6 w-6 rounded-lg p-1.5",
  md: "h-8 w-8 rounded-xl p-1.5",
  lg: "h-10 w-10 rounded-2xl p-2",
} as const;

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function DebtAccountIdentityFrame({
  debtType,
  identityMode,
  providerKey,
  providerName,
  issuerName,
  iconKey,
  accentColor,
  customImageAssetId,
  size = "md",
}: DebtAccountIdentityFrameProps) {
  const identity = getDebtAccountIdentity({
    debtType,
    identityMode,
    providerKey,
    providerName: providerName ?? "",
    issuerName,
    iconKey,
    accentColor,
    customImageAssetId,
  });

  const customImageSrc =
    identity.mode === "custom_image" &&
    typeof identity.customImageAssetId === "string" &&
    /^(https?:\/\/|\/)/.test(identity.customImageAssetId)
      ? identity.customImageAssetId
      : undefined;

  const shellStyle =
    identity.mode === "provider_logo" && identity.providerEntry
      ? {
          color: `#${identity.providerEntry.logo.hex}`,
          backgroundColor: rgba(`#${identity.providerEntry.logo.hex}`, 0.08),
          borderColor: rgba(`#${identity.providerEntry.logo.hex}`, 0.2),
        }
      : {
          color: identity.accentColor,
          backgroundColor: rgba(identity.accentColor, 0.1),
          borderColor: rgba(identity.accentColor, 0.2),
        };

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border ${sizeClasses[size]}`}
      style={shellStyle}
      aria-hidden="true"
    >
      {identity.mode === "provider_logo" && identity.providerEntry ? (
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor" role="presentation">
          <path d={identity.providerEntry.logo.path} />
        </svg>
      ) : customImageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={customImageSrc} alt="" className="h-full w-full object-contain" />
      ) : identity.iconOption ? (
        <Icon icon={identity.iconOption.icon} className="h-full w-full" />
      ) : (
        <ImageIcon className="h-full w-full" />
      )}
    </span>
  );
}
