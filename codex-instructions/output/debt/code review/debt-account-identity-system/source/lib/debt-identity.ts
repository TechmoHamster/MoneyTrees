import type { DebtAccount, DebtType } from "@/lib/types";
import type { IconifyIcon } from "@iconify/types";
import { siAfterpay, siAmericanexpress, siChase, siDiscover, siKlarna, siMastercard, siPaypal, siToyota, siVisa } from "simple-icons";
import badgeDollarSignIcon from "@iconify-icons/lucide/badge-dollar-sign";
import banknoteIcon from "@iconify-icons/lucide/banknote";
import carFrontIcon from "@iconify-icons/lucide/car-front";
import circleDollarSignIcon from "@iconify-icons/lucide/circle-dollar-sign";
import creditCardIcon from "@iconify-icons/lucide/credit-card";
import graduationCapIcon from "@iconify-icons/lucide/graduation-cap";
import homeIcon from "@iconify-icons/lucide/home";
import landmarkIcon from "@iconify-icons/lucide/landmark";
import packageIcon from "@iconify-icons/lucide/package";
import piggyBankIcon from "@iconify-icons/lucide/piggy-bank";
import receiptTextIcon from "@iconify-icons/lucide/receipt";
import shoppingBagIcon from "@iconify-icons/lucide/shopping-bag";
import storeIcon from "@iconify-icons/lucide/store";
import walletCardsIcon from "@iconify-icons/lucide/wallet-cards";

export type { DebtAccountIdentityMode } from "@/lib/types";

type DebtProviderLogoEntry = {
  key: string;
  label: string;
  aliases: string[];
  logo: {
    title: string;
    path: string;
    hex: string;
  };
};

export type DebtIconOption = {
  key: string;
  label: string;
  keywords: string[];
  icon: IconifyIcon;
  recommendedFor?: DebtType[];
};

const providerLogoRegistry: DebtProviderLogoEntry[] = [
  {
    key: "afterpay",
    label: "Afterpay",
    aliases: ["afterpay"],
    logo: siAfterpay,
  },
  {
    key: "american-express",
    label: "American Express",
    aliases: ["american express", "amex"],
    logo: siAmericanexpress,
  },
  {
    key: "chase",
    label: "Chase",
    aliases: ["chase", "jp morgan chase", "jpmorgan chase"],
    logo: siChase,
  },
  {
    key: "discover",
    label: "Discover",
    aliases: ["discover"],
    logo: siDiscover,
  },
  {
    key: "klarna",
    label: "Klarna",
    aliases: ["klarna"],
    logo: siKlarna,
  },
  {
    key: "mastercard",
    label: "Mastercard",
    aliases: ["mastercard", "master card"],
    logo: siMastercard,
  },
  {
    key: "paypal",
    label: "PayPal",
    aliases: ["paypal", "pay pal"],
    logo: siPaypal,
  },
  {
    key: "toyota",
    label: "Toyota",
    aliases: ["toyota", "toyota financial", "toyota financial services"],
    logo: siToyota,
  },
  {
    key: "visa",
    label: "Visa",
    aliases: ["visa"],
    logo: siVisa,
  },
];

export const DEBT_PROVIDER_LOGO_REGISTRY = providerLogoRegistry;

export const DEBT_IDENTITY_ICON_OPTIONS: DebtIconOption[] = [
  {
    key: "lucide:credit-card",
    label: "Credit Card",
    keywords: ["card", "credit", "issuer"],
    icon: creditCardIcon,
    recommendedFor: ["Credit Card"],
  },
  {
    key: "lucide:car-front",
    label: "Car",
    keywords: ["vehicle", "auto", "loan"],
    icon: carFrontIcon,
    recommendedFor: ["Auto Loan"],
  },
  {
    key: "lucide:home",
    label: "Home",
    keywords: ["house", "mortgage", "property"],
    icon: homeIcon,
    recommendedFor: ["Mortgage"],
  },
  {
    key: "lucide:graduation-cap",
    label: "Graduation Cap",
    keywords: ["student", "education", "school"],
    icon: graduationCapIcon,
    recommendedFor: ["Student Loan"],
  },
  {
    key: "lucide:landmark",
    label: "Landmark",
    keywords: ["bank", "loan", "lender"],
    icon: landmarkIcon,
    recommendedFor: ["Other Loan", "Mortgage"],
  },
  {
    key: "lucide:banknote",
    label: "Banknote",
    keywords: ["cash", "loan", "money"],
    icon: banknoteIcon,
    recommendedFor: ["Other Loan"],
  },
  {
    key: "lucide:wallet-cards",
    label: "Wallet",
    keywords: ["line", "credit", "wallet"],
    icon: walletCardsIcon,
    recommendedFor: ["Line of Credit", "Installment Loan"],
  },
  {
    key: "lucide:circle-dollar-sign",
    label: "Circle Dollar",
    keywords: ["dollar", "credit", "line"],
    icon: circleDollarSignIcon,
    recommendedFor: ["Line of Credit"],
  },
  {
    key: "lucide:shopping-bag",
    label: "Shopping Bag",
    keywords: ["bnpl", "shopping", "purchase"],
    icon: shoppingBagIcon,
    recommendedFor: ["BNPL"],
  },
  {
    key: "lucide:receipt-text",
    label: "Receipt",
    keywords: ["receipt", "purchase", "plan"],
    icon: receiptTextIcon,
    recommendedFor: ["Financed Purchase", "BNPL"],
  },
  {
    key: "lucide:package",
    label: "Package",
    keywords: ["item", "purchase", "financed"],
    icon: packageIcon,
    recommendedFor: ["Financed Purchase"],
  },
  {
    key: "lucide:badge-dollar-sign",
    label: "Badge Dollar",
    keywords: ["installment", "money", "payment"],
    icon: badgeDollarSignIcon,
    recommendedFor: ["Installment Loan"],
  },
  {
    key: "lucide:piggy-bank",
    label: "Piggy Bank",
    keywords: ["savings", "loan", "budget"],
    icon: piggyBankIcon,
    recommendedFor: ["Installment Loan", "Financed Purchase"],
  },
  {
    key: "lucide:store",
    label: "Store",
    keywords: ["merchant", "retail", "provider"],
    icon: storeIcon,
    recommendedFor: ["Financed Purchase", "BNPL"],
  },
];

export const DEBT_IDENTITY_ACCENT_BY_TYPE: Record<DebtType, string> = {
  Mortgage: "#06b6d4",
  "Credit Card": "#2563eb",
  "Auto Loan": "#0ea5e9",
  "Student Loan": "#8b5cf6",
  "Other Loan": "#f97316",
  "Line of Credit": "#14b8a6",
  "Installment Loan": "#f59e0b",
  BNPL: "#10b981",
  "Financed Purchase": "#f43f5e",
};

export const DEBT_IDENTITY_COLOR_OPTIONS = [
  "#2563eb",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#f97316",
  "#f43f5e",
  "#14b8a6",
  "#0ea5e9",
  "#64748b",
] as const;

const DEFAULT_DEBT_ICON_BY_TYPE: Record<DebtType, string> = {
  Mortgage: "lucide:home",
  "Credit Card": "lucide:credit-card",
  "Auto Loan": "lucide:car-front",
  "Student Loan": "lucide:graduation-cap",
  "Other Loan": "lucide:banknote",
  "Line of Credit": "lucide:circle-dollar-sign",
  "Installment Loan": "lucide:badge-dollar-sign",
  BNPL: "lucide:shopping-bag",
  "Financed Purchase": "lucide:receipt-text",
};

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeDebtIdentityColor(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const candidate = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : undefined;
}

export function getDefaultDebtIconKey(debtType: DebtType): string {
  return DEFAULT_DEBT_ICON_BY_TYPE[debtType];
}

export function getDefaultDebtAccentColor(debtType: DebtType): string {
  return DEBT_IDENTITY_ACCENT_BY_TYPE[debtType];
}

export function getDebtIconOption(key?: string): DebtIconOption | undefined {
  return DEBT_IDENTITY_ICON_OPTIONS.find((option) => option.key === key);
}

export function getDebtProviderLogoEntry(key?: string): DebtProviderLogoEntry | undefined {
  return providerLogoRegistry.find((entry) => entry.key === key);
}

export function suggestDebtProviderKey(...candidates: Array<string | undefined>): string | undefined {
  const normalizedCandidates = candidates
    .map((value) => (typeof value === "string" ? normalizeSearchValue(value) : ""))
    .filter(Boolean);

  if (normalizedCandidates.length === 0) {
    return undefined;
  }

  return providerLogoRegistry.find((entry) =>
    entry.aliases.some((alias) => {
      const normalizedAlias = normalizeSearchValue(alias);
      return normalizedCandidates.some(
        (candidate) =>
          candidate === normalizedAlias ||
          candidate.includes(normalizedAlias) ||
          normalizedAlias.includes(candidate),
      );
    }),
  )?.key;
}

export function searchDebtIconOptions(query: string, debtType?: DebtType): DebtIconOption[] {
  const normalizedQuery = normalizeSearchValue(query);
  const ranked = DEBT_IDENTITY_ICON_OPTIONS.map((option) => {
    const haystack = [option.label, ...option.keywords].map(normalizeSearchValue);
    const recommended = debtType ? option.recommendedFor?.includes(debtType) : false;
    const matchesQuery =
      normalizedQuery.length === 0 || haystack.some((entry) => entry.includes(normalizedQuery));

    return {
      option,
      recommended,
      matchesQuery,
    };
  }).filter((entry) => entry.matchesQuery);

  return ranked
    .sort((left, right) => {
      if (left.recommended !== right.recommended) {
        return left.recommended ? -1 : 1;
      }
      return left.option.label.localeCompare(right.option.label);
    })
    .map((entry) => entry.option);
}

export function getDebtAccountDisplayName(account: Pick<DebtAccount, "displayLabel" | "providerName">): string {
  return account.displayLabel?.trim() || account.providerName;
}

export function getDebtAccountIdentity(account: Pick<DebtAccount, "debtType" | "identityMode" | "providerKey" | "providerName" | "issuerName" | "iconKey" | "accentColor" | "customImageAssetId">) {
  const suggestedProviderKey = suggestDebtProviderKey(account.providerKey, account.providerName, account.issuerName);
  const providerKey = account.providerKey || suggestedProviderKey;
  const providerEntry = getDebtProviderLogoEntry(providerKey);
  const iconKey = account.iconKey || getDefaultDebtIconKey(account.debtType);
  const iconOption = getDebtIconOption(iconKey) ?? getDebtIconOption(getDefaultDebtIconKey(account.debtType));
  const accentColor = normalizeDebtIdentityColor(account.accentColor) ?? getDefaultDebtAccentColor(account.debtType);

  return {
    mode: account.identityMode ?? "none",
    providerKey,
    providerEntry,
    iconKey: iconOption?.key ?? getDefaultDebtIconKey(account.debtType),
    iconOption,
    accentColor,
    customImageAssetId: account.customImageAssetId,
  };
}
