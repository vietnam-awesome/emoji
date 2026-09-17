// Shared touch primitives aligned with beUI.
// Source: https://beui.dev/components/motion

export const TOUCH_GESTURE_CLASS = "select-none [-webkit-touch-callout:none]";
export const TOUCH_GESTURE_CONTENT_CLASS =
  "[-webkit-touch-callout:none] pointer-coarse:select-none";

export function holdSelection(element: HTMLElement) {
  element.style.setProperty("user-select", "none");
  element.style.setProperty("-webkit-user-select", "none");
  return () => {
    element.style.removeProperty("user-select");
    element.style.removeProperty("-webkit-user-select");
  };
}

export function capturePointer(element: Element, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Pointer is no longer active; touch still has implicit capture.
  }
}

export function releasePointer(element: Element, pointerId: number) {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Capture already released by the browser.
  }
}

export const isHoveringPointer = (event: { pointerType: string; buttons: number }) =>
  event.pointerType !== "touch" && event.buttons === 0;
