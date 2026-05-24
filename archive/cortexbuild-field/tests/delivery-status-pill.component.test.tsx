// @vitest-environment happy-dom
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DeliveryStatusPill } from "@/components/delivery-status-pill";

afterEach(() => cleanup());

type DeliveryStatus = "expected" | "delivered" | "rejected" | "cancelled";

describe("<DeliveryStatusPill>", () => {
  it.each<[DeliveryStatus, string]>([
    ["expected",  "Expected"],
    ["delivered", "Delivered"],
    ["rejected",  "Rejected"],
    ["cancelled", "Cancelled"],
  ])("renders the right label for %s", (status, label) => {
    render(<DeliveryStatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
