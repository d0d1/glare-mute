import type { AppLanguage } from "../contracts";
import type { Messages, ResolvedLanguage } from "./types";

export const LOCALE_TAG: Record<ResolvedLanguage, string> = {
  en: "en-US",
  "pt-BR": "pt-BR",
  es: "es-ES",
};

export function resolveEffectiveLanguage(language: AppLanguage): ResolvedLanguage {
  if (language !== "system") {
    return language;
  }

  if (typeof navigator === "undefined") {
    return "en";
  }

  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();

    if (normalized.startsWith("pt-br") || normalized.startsWith("pt")) {
      return "pt-BR";
    }

    if (normalized.startsWith("es")) {
      return "es";
    }

    if (normalized.startsWith("en")) {
      return "en";
    }
  }

  return "en";
}

export function languageOptions(messages: Messages): Array<{ label: string; value: AppLanguage }> {
  return [
    { label: messages.system, value: "system" },
    { label: "English", value: "en" },
    { label: "Português (Brasil)", value: "pt-BR" },
    { label: "Español", value: "es" },
  ];
}
