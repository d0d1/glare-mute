import { __resetMockDesktopClient, desktopClient } from "./desktop-client";

describe("desktopClient mock runtime", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetMockDesktopClient();
  });

  it("boots with the preview snapshot", async () => {
    const snapshot = await desktopClient.bootstrapState();

    expect(snapshot.appName).toBe("GlareMute");
    expect(snapshot.platform.backendId).toBe("browser-preview");
    expect(snapshot.diagnostics.recentEvents.length).toBeGreaterThan(0);
  });

  it("persists theme changes", async () => {
    await desktopClient.bootstrapState();
    const nextSnapshot = await desktopClient.setThemePreference("light");

    expect(nextSnapshot.settings.themePreference).toBe("light");
  });

  it("toggles suspended state", async () => {
    await desktopClient.bootstrapState();
    const nextSnapshot = await desktopClient.toggleSuspend();

    expect(nextSnapshot.diagnostics.suspended).toBe(true);
  });
});
