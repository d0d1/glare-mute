import { applyDocumentTheme, resolveEffectiveTheme } from "./theme";

describe("theme helpers", () => {
  it("resolves system theme against the media preference", () => {
    expect(resolveEffectiveTheme("system", true)).toBe("dark");
    expect(resolveEffectiveTheme("system", false)).toBe("light");
  });

  it("keeps explicit overrides stable", () => {
    expect(resolveEffectiveTheme("light", true)).toBe("light");
    expect(resolveEffectiveTheme("dark", false)).toBe("dark");
  });

  it("writes the document theme token", () => {
    applyDocumentTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
