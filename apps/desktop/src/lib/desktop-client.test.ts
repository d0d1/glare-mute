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
    expect(nextSnapshot.lens.status).toBe("suspended");
  });

  it("attaches the mock greyscale lens to a listed window", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates[0];
    const nextSnapshot = await desktopClient.attachWindow(candidate.windowId, "greyscaleInvert");

    expect(nextSnapshot.lens.activeTarget?.windowId).toBe(candidate.windowId);
    expect(nextSnapshot.lens.activePreset).toBe("greyscaleInvert");
    expect(nextSnapshot.lens.status).toBe("attached");
  });

  it("keeps minimized windows in the list and applies pending output until they return", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates.find(
      (entry) => entry.attachmentState === "minimized"
    );

    expect(candidate).toBeDefined();
    if (!candidate) {
      throw new Error("Expected a minimized mock window.");
    }

    const nextSnapshot = await desktopClient.attachWindow(candidate.windowId, "dark");

    expect(nextSnapshot.lens.activeTarget?.windowId).toBe(candidate.windowId);
    expect(nextSnapshot.lens.activePreset).toBe("dark");
    expect(nextSnapshot.lens.status).toBe("pending");
  });

  it("refreshes the mock window list", async () => {
    await desktopClient.bootstrapState();
    const nextSnapshot = await desktopClient.refreshWindowCandidates();

    expect(nextSnapshot.windowCandidates.length).toBeGreaterThan(0);
  });
});
