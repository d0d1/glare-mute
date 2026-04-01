import { render, screen } from "@testing-library/react";

import type { WindowDescriptor } from "../../lib/contracts";
import { getMessages } from "../../lib/i18n";
import { WindowRow } from "./WindowRow";

const messages = getMessages("en");

function makeCandidate(overrides: Partial<WindowDescriptor> = {}): WindowDescriptor {
  return {
    windowId: "0x00010001",
    logicalTargetId: "logical:window:0x00010001",
    secondaryLabel: null,
    title: "Clock",
    executablePath: "C:\\Windows\\System32\\ApplicationFrameHost.exe",
    processId: 4720,
    windowClass: "ApplicationFrameWindow",
    bounds: { left: 120, top: 80, width: 640, height: 480 },
    attachmentState: "available",
    isForeground: true,
    ...overrides,
  };
}

describe("WindowRow", () => {
  it("renders the title without showing process name by default", () => {
    render(
      <WindowRow
        candidate={makeCandidate()}
        lensStatus={null}
        messages={messages}
        onSelect={() => undefined}
        selected={false}
      />
    );

    expect(screen.getByText("Clock")).toBeInTheDocument();
    expect(screen.queryByText("ApplicationFrameHost.exe")).not.toBeInTheDocument();
  });

  it("shows a secondary label only when disambiguation is needed", () => {
    render(
      <WindowRow
        candidate={makeCandidate({ secondaryLabel: "PID 4720" })}
        lensStatus={null}
        messages={messages}
        onSelect={() => undefined}
        selected={false}
      />
    );

    expect(screen.getByText("PID 4720")).toBeInTheDocument();
  });
});
