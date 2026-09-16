"use client";
// Source aligned with https://beui.dev/components/motion/select

import { Check, ChevronDown } from "lucide-react";
import {
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EASE_OUT } from "../../lib/ease";
import { cn } from "../../lib/utils";

const INSTANT_TRANSITION: Transition = { duration: 0 };
const CHEVRON_TRANSITION: Transition = { type: "spring", duration: 0.4, bounce: 0.3 };

const LIST_VARIANTS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};

const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -6, filter: "blur(3px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

type Placement = "bottom" | "top";

interface SelectContextValue {
  value: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  select: (value: string) => void;
  register: (value: string, label: string) => void;
  unregister: (value: string) => void;
  labelFor: (value: string | undefined) => string | undefined;
  reduce: boolean;
  triggerId: string;
  listId: string;
  disabled: boolean;
  placement: Placement;
  setPlacement: (placement: Placement) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
  const context = useContext(SelectContext);
  if (!context) throw new Error(`${component} must be used within <Select>`);
  return context;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  className,
  children,
}: SelectProps) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [placement, setPlacement] = useState<Placement>("bottom");
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const select = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
      setOpen(false);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((entryValue: string, label: string) => {
    setLabels((currentLabels) =>
      currentLabels.get(entryValue) === label
        ? currentLabels
        : new Map(currentLabels).set(entryValue, label),
    );
  }, []);

  const unregister = useCallback((entryValue: string) => {
    setLabels((currentLabels) => {
      if (!currentLabels.has(entryValue)) return currentLabels;
      const next = new Map(currentLabels);
      next.delete(entryValue);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const contextValue = useMemo<SelectContextValue>(
    () => ({
      value: current,
      open,
      setOpen,
      select,
      register,
      unregister,
      labelFor: (entryValue) => (entryValue === undefined ? undefined : labels.get(entryValue)),
      reduce,
      triggerId: `${baseId}-trigger`,
      listId: `${baseId}-list`,
      disabled,
      placement,
      setPlacement,
    }),
    [
      current,
      open,
      select,
      register,
      unregister,
      labels,
      reduce,
      baseId,
      disabled,
      placement,
    ],
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <div ref={rootRef} className={cn("relative", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps {
  className?: string;
  children: ReactNode;
}

export function SelectTrigger({ className, children }: SelectTriggerProps) {
  const context = useSelectContext("SelectTrigger");
  const isTop = context.placement === "top";
  const keyframes = context.open ? [0, 0, 12] : [12, 0, 12];
  const keyframeTransition: Transition = context.reduce
    ? { duration: 0 }
    : context.open
      ? { duration: 0.6, times: [0, 0.4, 1], ease: EASE_OUT }
      : { duration: 0.42, times: [0, 0.5, 1], ease: EASE_OUT };

  return (
    <motion.button
      type="button"
      id={context.triggerId}
      disabled={context.disabled}
      aria-haspopup="listbox"
      aria-expanded={context.open}
      aria-controls={context.listId}
      onClick={() => context.setOpen(!context.open)}
      initial={false}
      animate={{
        borderTopLeftRadius: isTop ? keyframes : 12,
        borderTopRightRadius: isTop ? keyframes : 12,
        borderBottomLeftRadius: isTop ? 12 : keyframes,
        borderBottomRightRadius: isTop ? 12 : keyframes,
      }}
      transition={{
        borderTopLeftRadius: isTop ? keyframeTransition : INSTANT_TRANSITION,
        borderTopRightRadius: isTop ? keyframeTransition : INSTANT_TRANSITION,
        borderBottomLeftRadius: isTop ? INSTANT_TRANSITION : keyframeTransition,
        borderBottomRightRadius: isTop ? INSTANT_TRANSITION : keyframeTransition,
      }}
      className={cn(
        "relative z-10 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors",
        "hover:border-(--color-border-strong) focus-visible:ring-2 focus-visible:ring-foreground/20",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
      <motion.span
        aria-hidden
        animate={{ rotate: context.open ? 180 : 0 }}
        transition={context.reduce ? { duration: 0 } : CHEVRON_TRANSITION}
        className="text-muted-foreground"
      >
        <ChevronDown className="h-4 w-4" />
      </motion.span>
    </motion.button>
  );
}

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export function SelectValue({ placeholder, className }: SelectValueProps) {
  const context = useSelectContext("SelectValue");
  const label = context.labelFor(context.value);
  return (
    <span className={cn(label ? "text-foreground" : "text-muted-foreground", className)}>
      {label ?? placeholder ?? "Select"}
    </span>
  );
}

export interface SelectContentProps {
  className?: string;
  children: ReactNode;
}

export function SelectContent({ className, children }: SelectContentProps) {
  const context = useSelectContext("SelectContent");
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const open = context.open;
  const { setPlacement } = context;

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  });

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = document.getElementById(context.triggerId);
    const node = innerRef.current;
    if (!trigger || !node) return;
    const rect = trigger.getBoundingClientRect();
    const contentHeight = node.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    setPlacement(below < contentHeight + 16 && above > below ? "top" : "bottom");
  }, [open, context.triggerId, setPlacement]);

  const isTop = context.placement === "top";
  const nearGap = open ? 8 : 0;
  const nearRadius = open ? 12 : 0;
  const gapTransition: Transition = open
    ? { type: "spring", duration: 0.6, bounce: 0.5, delay: 0.12 }
    : { type: "spring", duration: 0.3, bounce: 0.1 };
  const radiusTransition: Transition = open
    ? { duration: 0.3, ease: EASE_OUT, delay: 0.14 }
    : { duration: 0.16, ease: EASE_OUT };

  return (
    <motion.div
      id={context.listId}
      role="listbox"
      aria-labelledby={context.triggerId}
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={
        context.reduce
          ? { opacity: open ? 1 : 0, height: open ? height : 0 }
          : {
              opacity: open ? 1 : 0,
              height: open ? height : 0,
              marginTop: isTop ? 0 : nearGap,
              marginBottom: isTop ? nearGap : 0,
              borderTopLeftRadius: isTop ? 12 : nearRadius,
              borderTopRightRadius: isTop ? 12 : nearRadius,
              borderBottomLeftRadius: isTop ? nearRadius : 12,
              borderBottomRightRadius: isTop ? nearRadius : 12,
            }
      }
      transition={
        context.reduce
          ? { duration: 0.12 }
          : {
              opacity: open
                ? { duration: 0.18 }
                : { duration: 0.16, delay: 0.12 },
              height: open
                ? { type: "spring", duration: 0.42, bounce: 0.14 }
                : { duration: 0.26, ease: EASE_OUT, delay: 0.14 },
              marginTop: isTop ? INSTANT_TRANSITION : gapTransition,
              marginBottom: isTop ? gapTransition : INSTANT_TRANSITION,
              borderTopLeftRadius: isTop ? INSTANT_TRANSITION : radiusTransition,
              borderTopRightRadius: isTop ? INSTANT_TRANSITION : radiusTransition,
              borderBottomLeftRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
              borderBottomRightRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
            }
      }
      style={{
        transformOrigin: isTop ? "bottom" : "top",
        overflow: "hidden",
        pointerEvents: open ? "auto" : "none",
      }}
      className={cn(
        "absolute left-0 right-0 z-20 rounded-xl border border-border bg-background shadow-lg",
        isTop ? "bottom-full" : "top-full",
        className,
      )}
    >
      <motion.div
        ref={innerRef}
        variants={context.reduce ? undefined : LIST_VARIANTS}
        initial={false}
        animate={open ? "show" : "hidden"}
        className="p-1"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export interface SelectItemProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function SelectItem({ value, disabled = false, className, children }: SelectItemProps) {
  const context = useSelectContext("SelectItem");
  const selected = context.value === value;
  const label = typeof children === "string" ? children : value;

  useLayoutEffect(() => {
    context.register(value, label);
    return () => context.unregister(value);
  }, [context.register, context.unregister, value, label]);

  return (
    <motion.li variants={context.reduce ? undefined : ITEM_VARIANTS}>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        disabled={disabled}
        onClick={() => context.select(value)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm outline-none transition-colors",
          selected
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        {children}
        {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
      </button>
    </motion.li>
  );
}
