import { describe, expect, it, vi } from "vitest";
import { scrimDismissHandlers } from "../src/hooks/useScrimDismiss";

type Handlers = ReturnType<typeof scrimDismissHandlers>;

function event(target: string, currentTarget: string) {
  return { target, currentTarget } as unknown as Parameters<Handlers["onClick"]>[0];
}

function handlers(onDismiss: () => void): Handlers {
  return scrimDismissHandlers({ current: false }, onDismiss);
}

describe("scrimDismissHandlers", () => {
  it("closes when a click starts and ends on the scrim", () => {
    const onDismiss = vi.fn();
    const { onPointerDown, onClick } = handlers(onDismiss);

    onPointerDown(event("scrim", "scrim"));
    onClick(event("scrim", "scrim"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("stays open when a selection drag starts in the dialog and ends on the scrim", () => {
    const onDismiss = vi.fn();
    const { onPointerDown, onClick } = handlers(onDismiss);

    onPointerDown(event("input", "scrim"));
    onClick(event("scrim", "scrim"));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stays open for clicks that land inside the dialog", () => {
    const onDismiss = vi.fn();
    const { onPointerDown, onClick } = handlers(onDismiss);

    onPointerDown(event("button", "scrim"));
    onClick(event("button", "scrim"));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not carry a stale press into the next click", () => {
    const onDismiss = vi.fn();
    const { onPointerDown, onClick } = handlers(onDismiss);

    onPointerDown(event("scrim", "scrim"));
    onClick(event("scrim", "scrim"));
    onClick(event("scrim", "scrim"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
