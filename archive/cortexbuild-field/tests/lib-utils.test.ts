import { describe, expect, it } from "vitest";
import { cn } from "../lib/utils";

/**
 * Coverage for the `cn()` Tailwind class-name combiner.
 *
 * `cn = twMerge(clsx(...))` — clsx folds in conditional class names,
 * twMerge resolves Tailwind conflicts so the LAST value wins. The
 * combination is what every UI helper in `app/` and `components/`
 * relies on; a regression here would silently break theming.
 */

describe("cn — Tailwind class-name combiner", () => {
  it("joins simple string arguments with spaces", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("filters out falsy values (false / null / undefined / '')", () => {
    expect(cn("px-4", false && "ignored", null, undefined, "", "py-2")).toBe(
      "px-4 py-2",
    );
  });

  it("flattens conditional class objects (clsx semantics)", () => {
    expect(cn("base", { "is-active": true, "is-hidden": false })).toBe(
      "base is-active",
    );
  });

  it("flattens arrays of class names", () => {
    expect(cn(["px-4", ["py-2", "text-base"]])).toBe("px-4 py-2 text-base");
  });

  it("twMerge: last padding-x wins (the load-bearing reason cn exists)", () => {
    // clsx alone would emit both 'px-2 px-6'; twMerge resolves the
    // conflict so the override wins. This is what justifies the helper —
    // a regression here would cause double-padding bugs everywhere.
    expect(cn("px-2", "px-6")).toBe("px-6");
  });

  it("twMerge: keeps non-conflicting classes alongside the resolved override", () => {
    expect(cn("px-2 py-4 text-sm", "px-6")).toBe("py-4 text-sm px-6");
  });

  it("returns empty string when no truthy inputs", () => {
    expect(cn()).toBe("");
    expect(cn(false, null, undefined)).toBe("");
  });
});
