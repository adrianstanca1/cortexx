// @vitest-environment happy-dom
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RfiStatusPill } from "@/components/rfi-status-pill";
import type { RfiStatus } from "@/lib/rfi-actions";

afterEach(() => cleanup());

describe("<RfiStatusPill>", () => {
  it.each<[RfiStatus, string]>([
    ["submitted", "Submitted"],
    ["answered",  "Answered"],
    ["approved",  "Approved"],
    ["rejected",  "Rejected"],
  ])("renders the human-readable label for status=%s", (status, label) => {
    render(<RfiStatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies a distinct background colour per status — colours are not shared", () => {
    const colours = new Set<string>();
    for (const status of ["submitted", "answered", "approved", "rejected"] as RfiStatus[]) {
      const { container, unmount } = render(<RfiStatusPill status={status} />);
      // RN-Web flattens style props onto the outer div as inline style.
      const root = container.firstChild as HTMLElement;
      colours.add(root.style.backgroundColor || "");
      unmount();
    }
    expect(colours.size).toBe(4);
  });
});
