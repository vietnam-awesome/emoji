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
    <div className="category-list beui-category-list">
      {items.map((item) => (
        <motion.a
          key={item.href}
          className="category-chip beui-category-pill"
          href={item.href}
          whileHover={canHover && !reduceMotion ? { y: -2, scale: 1.015 } : undefined}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          transition={SPRING_PRESS}
        >
          <span>{item.name}</span>
          <small>{item.count.toLocaleString('en-US')}</small>
        </motion.a>
      ))}
    </div>
  );
}
