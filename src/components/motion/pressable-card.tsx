"use client";
// Reusable BEUI-style interactive surface for card-sized controls.

import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import { forwardRef, type ReactNode } from "react";
import { SPRING_PRESS } from "../../lib/ease";
import { useHoverCapable } from "../../lib/hooks/use-hover-capable";
import { cn } from "../../lib/utils";

export interface PressableCardProps extends Omit<HTMLMotionProps<"button">, "children"> {
  selected?: boolean;
  children?: ReactNode;
}

export const PressableCard = forwardRef<HTMLButtonElement, PressableCardProps>(
  function PressableCard(
    {
      selected = false,
      className,
      children,
      whileHover,
      whileTap,
      transition,
      ...rest
    },
    ref,
  ) {
    const reduceMotion = useReducedMotion();
    const canHover = useHoverCapable();

    return (
      <motion.button
        ref={ref}
        type="button"
        data-beui-pressable-card
        data-selected={selected ? "true" : "false"}
        whileHover={
          whileHover ??
          (reduceMotion || !canHover ? undefined : { y: -2, scale: 1.01 })
        }
        whileTap={whileTap ?? (reduceMotion ? undefined : { scale: 0.97 })}
        transition={transition ?? SPRING_PRESS}
        className={cn(
          "relative min-w-0 select-none border border-border bg-background text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          selected && "border-border-strong bg-card shadow-[inset_0_0_0_1px_var(--border-strong)]",
          className,
        )}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);
