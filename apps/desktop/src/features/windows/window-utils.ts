import type { AppSnapshot, WindowDescriptor } from "../../lib/contracts";
import { type Messages, getMessages } from "../../lib/i18n";

export function filterWindowCandidates(candidates: WindowDescriptor[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return candidates;
  }

  return candidates.filter((candidate) => {
    const haystack = [
      candidate.title,
      candidate.executablePath ?? "",
      executableName(getMessages("en"), candidate.executablePath),
      candidate.windowClass ?? "",
      candidate.attachmentState,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function windowListSubtitle(messages: Messages, totalCount: number, query: string) {
  if (query.trim()) {
    return messages.windowsMatch(totalCount);
  }

  return messages.windowsShown(totalCount);
}

export function executableName(messages: Messages, path: string | null) {
  if (!path) {
    return messages.executableUnavailable;
  }

  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

export function formatBounds(candidate: WindowDescriptor) {
  return `${candidate.bounds.width}x${candidate.bounds.height} at ${candidate.bounds.left}, ${candidate.bounds.top}`;
}

export function windowLensStatus(
  candidate: WindowDescriptor,
  coveredWindowIds: Set<string>
): AppSnapshot["lens"]["status"] | null {
  if (!coveredWindowIds.has(candidate.windowId)) {
    return null;
  }

  return candidate.attachmentState === "minimized" ? "pending" : "attached";
}
