import type { WindowDescriptor } from "./contracts";
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

  it("saves a mock effect for a listed app", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates[0];
    const nextSnapshot = await desktopClient.saveProfileFromWindow(
      candidate.logicalTargetId,
      "greyscaleInvert"
    );

    expect(nextSnapshot.settings.profiles).toHaveLength(1);
    expect(nextSnapshot.settings.profiles[0]?.preset).toBe("greyscaleInvert");
    expect(nextSnapshot.lens.status).toBe("attached");
    expect(nextSnapshot.lens.profileSnapshots).toHaveLength(1);
    expect(nextSnapshot.lens.coveredTargets.length).toBeGreaterThan(1);
  });

  it("keeps minimized windows in the list and marks saved output pending until they return", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates.find(
      (entry: WindowDescriptor) => entry.attachmentState === "minimized"
    );

    expect(candidate).toBeDefined();
    if (!candidate) {
      throw new Error("Expected a minimized mock window.");
    }

    const nextSnapshot = await desktopClient.saveProfileFromWindow(
      candidate.logicalTargetId,
      "invert"
    );

    expect(nextSnapshot.lens.status).toBe("pending");
  });

  it("can disable related-window coverage while keeping the saved app", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates[0];

    await desktopClient.saveProfileFromWindow(candidate.logicalTargetId, "greyscaleInvert");
    const nextSnapshot = await desktopClient.setApplyToRelatedWindows(false);

    expect(nextSnapshot.settings.applyToRelatedWindows).toBe(false);
    expect(nextSnapshot.lens.coveredTargets).toHaveLength(1);
  });

  it("can disable and re-enable a saved app", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates[0];

    const savedSnapshot = await desktopClient.saveProfileFromWindow(
      candidate.logicalTargetId,
      "invert"
    );
    const profileId = savedSnapshot.settings.profiles[0]?.id;
    expect(profileId).toBeDefined();
    if (!profileId) {
      throw new Error("Expected a saved profile id.");
    }

    const disabledSnapshot = await desktopClient.setProfileEnabled(profileId, false);
    expect(disabledSnapshot.settings.profiles[0]?.enabled).toBe(false);
    expect(disabledSnapshot.lens.status).toBe("detached");

    const enabledSnapshot = await desktopClient.setProfileEnabled(profileId, true);
    expect(enabledSnapshot.settings.profiles[0]?.enabled).toBe(true);
    expect(enabledSnapshot.lens.status).toBe("attached");
  });

  it("can remove a saved app", async () => {
    const snapshot = await desktopClient.bootstrapState();
    const candidate = snapshot.windowCandidates[0];

    const savedSnapshot = await desktopClient.saveProfileFromWindow(
      candidate.logicalTargetId,
      "invert"
    );
    const profileId = savedSnapshot.settings.profiles[0]?.id;
    expect(profileId).toBeDefined();
    if (!profileId) {
      throw new Error("Expected a saved profile id.");
    }

    const nextSnapshot = await desktopClient.removeProfile(profileId);
    expect(nextSnapshot.settings.profiles).toHaveLength(0);
    expect(nextSnapshot.lens.profileSnapshots).toHaveLength(0);
    expect(nextSnapshot.lens.status).toBe("detached");
  });

  it("refreshes the mock window list", async () => {
    await desktopClient.bootstrapState();
    const nextSnapshot = await desktopClient.refreshWindowCandidates();

    expect(nextSnapshot.windowCandidates.length).toBeGreaterThan(0);
  });
});
