import { __resetMockDesktopClient, desktopClient } from "./desktop-client";

describe("desktopClient mock runtime", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetMockDesktopClient();
  });

  it("boots with the preview snapshot", async () => {
    const snapshot = await desktopClient.bootstrapState();

    expect(snapshot.appName).toBe("Glare mute");
    expect(snapshot.settings.language).toBe("system");
    expect(snapshot.platform.backendId).toBe("browser-preview");
    expect(snapshot.diagnostics.recentEvents.length).toBeGreaterThan(0);
  });

  it("persists language changes", async () => {
    await desktopClient.bootstrapState();
    const nextSnapshot = await desktopClient.setLanguage("pt-BR");

    expect(nextSnapshot.settings.language).toBe("pt-BR");
  });

  it("persists theme changes", async () => {
    await desktopClient.bootstrapState();
    const nextSnapshot = await desktopClient.setThemePreference("light");

    expect(nextSnapshot.settings.themePreference).toBe("light");
  });

  it("attaches the mock greyscale lens to a listed window", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates[0];
    const nextSnapshot = await desktopClient.attachWindow(candidate.windowId, "greyscaleInvert");

    expect(nextSnapshot.lens.activeTarget?.windowId).toBe(candidate.windowId);
    expect(nextSnapshot.lens.activePreset).toBe("greyscaleInvert");
    expect(nextSnapshot.lens.status).toBe("attached");
    expect(nextSnapshot.lens.coveredTargets.length).toBeGreaterThan(1);
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

    const nextSnapshot = await desktopClient.attachWindow(candidate.windowId, "invert");

    expect(nextSnapshot.lens.activeTarget?.windowId).toBe(candidate.windowId);
    expect(nextSnapshot.lens.activePreset).toBe("invert");
    expect(nextSnapshot.lens.status).toBe("pending");
  });

  it("can disable related-window coverage while keeping the current target", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates[0];

    await desktopClient.attachWindow(candidate.windowId, "greyscaleInvert");
    const nextSnapshot = await desktopClient.setApplyToRelatedWindows(false);

    expect(nextSnapshot.settings.applyToRelatedWindows).toBe(false);
    expect(nextSnapshot.lens.activeTarget?.windowId).toBe(candidate.windowId);
    expect(nextSnapshot.lens.coveredTargets).toHaveLength(1);
  });

  it("refreshes the mock window list", async () => {
    await desktopClient.bootstrapState();
    const nextSnapshot = await desktopClient.refreshWindowCandidates();

    expect(nextSnapshot.windowCandidates.length).toBeGreaterThan(0);
  });
});
