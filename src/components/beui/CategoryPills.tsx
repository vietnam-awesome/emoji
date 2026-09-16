import { motion, useReducedMotion } from 'motion/react';
import { SPRING_PRESS } from '../../lib/ease';
import { useHoverCapable } from '../../lib/hooks/use-hover-capable';

type CategoryItem = {
  name: string;
  count: number;
  href: string;
};

interface Props {
  items: CategoryItem[];
}

export default function CategoryPills({ items }: Props) {
  const reduceMotion = useReducedMotion();
  const canHover = useHoverCapable();

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <motion.a
          key={item.href}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground no-underline shadow-sm transition-colors hover:border-border-strong hover:bg-card"
          href={item.href}
          whileHover={canHover && !reduceMotion ? { y: -1, scale: 1.01 } : undefined}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={SPRING_PRESS}
        >
          <span>{item.name}</span>
          <small className="border-l border-border pl-2 text-[.68rem] text-muted-foreground">
            {item.count.toLocaleString('en-US')}
          </small>
        </motion.a>
      ))}
    </div>
  );
}
