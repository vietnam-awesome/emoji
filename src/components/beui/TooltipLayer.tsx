"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

const TOOLTIP_SELECTOR = "[data-beui-tooltip]";
const HOVER_DELAY_MS = 260;

type TooltipState = {
  text: string;
  x: number;
  y: number;
  side: "top" | "bottom";
};

function readTooltipTrigger(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  const trigger = target.closest<HTMLElement>(TOOLTIP_SELECTOR);
  if (!trigger) return null;
  const text = trigger.dataset.beuiTooltip?.trim();
  return text ? { trigger, text } : null;
}

function measure(trigger: HTMLElement, text: string): TooltipState {
  const rect = trigger.getBoundingClientRect();
  const center = rect.left + rect.width / 2;
  const x = Math.max(72, Math.min(window.innerWidth - 72, center));
  const bottomSpace = window.innerHeight - rect.bottom;
  const topSpace = rect.top;
  const side = bottomSpace >= 56 || bottomSpace >= topSpace ? "bottom" : "top";

  return {
    text,
    x,
    y: side === "bottom" ? rect.bottom + 8 : rect.top - 8,
    side,
  };
}

export default function TooltipLayer() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const activeTrigger = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);

    const clearTimer = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };

    const hide = () => {
      clearTimer();
      activeTrigger.current = null;
      setTooltip(null);
    };

    const show = (trigger: HTMLElement, text: string, delayed: boolean) => {
      clearTimer();
      activeTrigger.current = trigger;
      const commit = () => {
        if (activeTrigger.current !== trigger || !trigger.isConnected) return;
        setTooltip(measure(trigger, text));
      };
      if (delayed) timer.current = window.setTimeout(commit, HOVER_DELAY_MS);
      else commit();
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const match = readTooltipTrigger(event.target);
      if (!match || activeTrigger.current === match.trigger) return;
      show(match.trigger, match.text, true);
    };

    const onPointerOut = (event: PointerEvent) => {
      const trigger = activeTrigger.current;
      if (!trigger) return;
      if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
      const leaving = event.target instanceof Element ? event.target.closest(TOOLTIP_SELECTOR) : null;
      if (leaving === trigger) hide();
    };

    const onFocusIn = (event: FocusEvent) => {
      const match = readTooltipTrigger(event.target);
      if (match) show(match.trigger, match.text, false);
    };

    const onFocusOut = (event: FocusEvent) => {
      const trigger = activeTrigger.current;
      if (!trigger) return;
      if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
      const leaving = event.target instanceof Element ? event.target.closest(TOOLTIP_SELECTOR) : null;
      if (leaving === trigger) hide();
    };

    const reposition = () => {
      const trigger = activeTrigger.current;
      const text = trigger?.dataset.beuiTooltip?.trim();
      if (!trigger || !text || !trigger.isConnected) {
        hide();
        return;
      }
      setTooltip((current) => current ? measure(trigger, text) : current);
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition, { passive: true });

    return () => {
      clearTimer();
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {tooltip ? (
        <motion.div
          role="tooltip"
          data-beui-tooltip-layer
          className="pointer-events-none fixed z-[10000] max-w-72 rounded-lg border border-border-strong bg-popover px-2.5 py-1.5 text-[11px] font-medium leading-4 text-popover-foreground shadow-xl"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transformOrigin: tooltip.side === "bottom" ? "top center" : "bottom center",
          }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: tooltip.side === "bottom" ? -3 : 3, scale: 0.97 }}
          animate={{
            opacity: 1,
            x: "-50%",
            y: tooltip.side === "top" ? "-100%" : 0,
            scale: 1,
          }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={reduceMotion ? { duration: 0.08 } : { duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          {tooltip.text}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
