import type { AppLanguage } from "../contracts";
import type { Messages, ResolvedLanguage } from "./types";

export const LOCALE_TAG: Record<ResolvedLanguage, string> = {
  ar: "ar",
  bn: "bn-BD",
  en: "en-US",
  fr: "fr-FR",
  hi: "hi-IN",
  "pt-BR": "pt-BR",
  es: "es-ES",
  "zh-Hans": "zh-CN",
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

    if (normalized.startsWith("fr")) {
      return "fr";
    }

    if (normalized.startsWith("zh-cn") || normalized.startsWith("zh-sg")) {
      return "zh-Hans";
    }

    if (normalized.startsWith("zh-hans")) {
      return "zh-Hans";
    }

    if (normalized.startsWith("hi")) {
      return "hi";
    }

    if (normalized.startsWith("ar")) {
      return "ar";
    }

    if (normalized.startsWith("bn")) {
      return "bn";
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
    { label: "Français", value: "fr" },
    { label: "简体中文", value: "zh-Hans" },
    { label: "हिन्दी", value: "hi" },
    { label: "العربية", value: "ar" },
    { label: "বাংলা", value: "bn" },
  ];
}
