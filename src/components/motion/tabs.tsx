"use client";
// Source aligned with https://beui.dev/components/motion/tabs

import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import { EASE_OUT } from "../../lib/ease";
import { cn } from "../../lib/utils";

type TabsVariant = "pill" | "segment" | "underline";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  variant: TabsVariant;
  layoutId: string;
  reduce: boolean;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string) {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`${component} must be used within <Tabs>`);
  return context;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  className?: string;
  children: ReactNode;
}

export function Tabs({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  variant = "segment",
  className,
  children,
}: TabsProps) {
  const reduce = useReducedMotion() ?? false;
  const id = useId();
  const controlled = valueProp !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ? valueProp : internal;

  const setValue = (next: string) => {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
  };

  const context = useMemo<TabsContextValue>(
    () => ({ value, setValue, variant, layoutId: `beui-tabs-${id}`, reduce }),
    [value, variant, id, reduce],
  );

  return (
    <TabsContext.Provider value={context}>
      <MotionConfig reducedMotion="user">
        <div className={className}>{children}</div>
      </MotionConfig>
    </TabsContext.Provider>
  );
}

const listClasses: Record<TabsVariant, string> = {
  pill: "inline-flex items-center gap-1 rounded-full bg-card p-1",
  segment: "inline-flex items-center gap-0 rounded-lg bg-card p-0.5",
  underline: "inline-flex items-center gap-1 border-b border-border",
};

export interface TabsListProps {
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}

export function TabsList({ className, children, "aria-label": ariaLabel }: TabsListProps) {
  const context = useTabsContext("TabsList");
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(listClasses[context.variant], className)}
    >
      {children}
    </div>
  );
}

const indicatorTransition: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 1.2,
};

export interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function TabsTrigger({ value, disabled, className, children }: TabsTriggerProps) {
  const context = useTabsContext("TabsTrigger");
  const active = context.value === value;

  const base =
    "relative isolate inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-50";

  const variantClass: Record<TabsVariant, string> = {
    pill: "rounded-full",
    segment: "rounded-md",
    underline: "pb-2",
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => context.setValue(value)}
      className={cn(
        base,
        variantClass[context.variant],
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {active ? (
        context.variant === "underline" ? (
          <motion.span
            layoutId={context.layoutId}
            className="absolute inset-x-0 -bottom-px -z-10 h-0.5 rounded-full bg-foreground"
            transition={context.reduce ? { duration: 0 } : indicatorTransition}
          />
        ) : (
          <motion.span
            layoutId={context.layoutId}
            className="absolute inset-0 -z-10 rounded-[inherit] border border-border bg-background shadow-sm"
            transition={context.reduce ? { duration: 0 } : indicatorTransition}
          />
        )
      ) : null}
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  className?: string;
  children: ReactNode;
}

export function TabsContent({ value, className, children }: TabsContentProps) {
  const context = useTabsContext("TabsContent");
  const active = context.value === value;

  if (!active) return null;

  return (
    <motion.div
      role="tabpanel"
      initial={context.reduce ? { opacity: 1 } : { opacity: 0, y: 4, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={context.reduce ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
