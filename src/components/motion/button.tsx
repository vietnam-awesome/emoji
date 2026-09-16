import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { SPRING_PRESS } from '../../lib/ease';
import { useHoverCapable } from '../../lib/hooks/use-hover-capable';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-[var(--ink)] text-white shadow-sm hover:bg-[#1d2939]',
  secondary: 'border-[var(--line)] bg-white text-[var(--ink-soft)] shadow-sm hover:border-[var(--line-strong)] hover:bg-[var(--surface-subtle)]',
  outline: 'border-[var(--line-strong)] bg-transparent text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]',
  ghost: 'border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-sm',
  icon: 'size-10 p-0'
};

const baseClasses = 'relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-lg border font-semibold no-underline transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

interface SharedProps {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children' | 'className'>, SharedProps {}
export interface ButtonLinkProps extends Omit<HTMLMotionProps<'a'>, 'children' | 'className' | 'href'>, SharedProps {
  href: string;
}

function usePressMotion() {
  const reduceMotion = useReducedMotion();
  const canHover = useHoverCapable();

  return {
    whileHover: canHover && !reduceMotion ? { y: -1, scale: 1.015 } : undefined,
    whileTap: reduceMotion ? undefined : { scale: 0.965 },
    transition: SPRING_PRESS
  };
}

/**
 * BeUI-style spring button primitive for Astro React islands.
 * Interaction model adapted from https://beui.dev/components/motion/button.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref
) {
  const motionProps = usePressMotion();

  return (
    <motion.button
      ref={ref}
      type={type}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...motionProps}
      {...props}
    >
      {children}
    </motion.button>
  );
});

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { children, className, variant = 'primary', size = 'md', href, ...props },
  ref
) {
  const motionProps = usePressMotion();

  return (
    <motion.a
      ref={ref}
      href={href}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...motionProps}
      {...props}
    >
      {children}
    </motion.a>
  );
});
