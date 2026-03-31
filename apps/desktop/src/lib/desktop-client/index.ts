import { createMockDesktopClient } from "./mock";
import { resetMockSnapshot } from "./mock-snapshot";
import { createTauriDesktopClient, isTauriRuntime } from "./runtime";

export const desktopClient = isTauriRuntime()
  ? createTauriDesktopClient()
  : createMockDesktopClient();

export function __resetMockDesktopClient() {
  resetMockSnapshot();
}
