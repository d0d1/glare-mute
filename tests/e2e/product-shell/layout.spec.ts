import { expect, test } from "@playwright/test";

test.describe("Glare mute layout contract", () => {
  test.setTimeout(60000);

  test("keeps the desktop workflow shell height-bounded so the window list becomes the scroller", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto("/");

    await expect(page.getByText("Available windows")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const shell = document.querySelector(".workflow-shell") as HTMLElement | null;
      const list = document.querySelector(".window-list") as HTMLElement | null;
      const effectPane = document.querySelector(".effect-pane") as HTMLElement | null;

      if (!shell || !list || !effectPane) {
        throw new Error("Expected workflow shell, window list, and effect pane.");
      }

      return {
        listClientHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
        effectClientHeight: effectPane.clientHeight,
        effectScrollHeight: effectPane.scrollHeight,
        shellHeight: Math.round(shell.getBoundingClientRect().height),
        viewportHeight: window.innerHeight,
      };
    });

    expect(metrics.shellHeight).toBeLessThan(metrics.viewportHeight);
    expect(metrics.listScrollHeight).toBeGreaterThan(metrics.listClientHeight);
    expect(metrics.effectScrollHeight).toBeLessThanOrEqual(metrics.effectClientHeight + 2);
  });

  test("keeps the stacked layout usable without clipping the effect pane", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 820 });
    await page.goto("/");

    await expect(page.getByText("Available windows")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const workflowShell = document.querySelector(".workflow-shell") as HTMLElement | null;
      const windowPane = document.querySelector(".window-pane") as HTMLElement | null;
      const effectPane = document.querySelector(".effect-pane") as HTMLElement | null;
      const list = document.querySelector(".window-list") as HTMLElement | null;

      if (!workflowShell || !windowPane || !effectPane || !list) {
        throw new Error("Expected workflow shell, panes, and window list.");
      }

      const shellStyle = window.getComputedStyle(workflowShell);
      const windowPaneRect = windowPane.getBoundingClientRect();
      const effectPaneRect = effectPane.getBoundingClientRect();

      return {
        gridColumnCount: shellStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
        listClientHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
        windowPaneBottom: Math.round(windowPaneRect.bottom),
        effectPaneTop: Math.round(effectPaneRect.top),
      };
    });

    expect(metrics.gridColumnCount).toBe(1);
    expect(metrics.listScrollHeight).toBeGreaterThan(metrics.listClientHeight);
    expect(metrics.effectPaneTop).toBeGreaterThanOrEqual(metrics.windowPaneBottom);
  });
});
