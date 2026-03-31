import type { ThemePreference } from "./contracts";

export type EffectiveTheme = "light" | "dark" | "invert" | "greyscale-invert";

export function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveEffectiveTheme(
  themePreference: ThemePreference,
  prefersDark: boolean
): EffectiveTheme {
  if (themePreference === "system") {
    return prefersDark ? "dark" : "light";
  }

  if (themePreference === "greyscaleInvert") {
    return "greyscale-invert";
  }

  if (themePreference === "invert") {
    return "invert";
  }

  return themePreference;
}

export function applyDocumentTheme(theme: EffectiveTheme) {
  document.documentElement.dataset.theme = theme;
}

export function watchSystemTheme(onChange: (prefersDark: boolean) => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);

  onChange(mediaQuery.matches);
  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}
