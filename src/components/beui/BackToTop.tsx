import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '../motion/button';
import { SPRING_PANEL } from '../../lib/ease';
import FigmaCursor from './FigmaCursor';

const MIN_SCROLLABLE_DISTANCE = 160;
const MIN_REVEAL_DISTANCE = 120;
const MAX_REVEAL_DISTANCE = 320;
const REVEAL_RATIO = 0.18;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let frame = 0;

    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const canScroll = maxScroll > MIN_SCROLLABLE_DISTANCE;
        const revealAt = Math.min(
          MAX_REVEAL_DISTANCE,
          Math.max(MIN_REVEAL_DISTANCE, maxScroll * REVEAL_RATIO),
        );

        setVisible(canScroll && window.scrollY >= revealAt);
      });
    };

    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(sync)
      : null;
    resizeObserver?.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <>
      <FigmaCursor
        name="you"
        color="var(--foreground)"
        tagTextColor="var(--background)"
      />

      <AnimatePresence>
        {visible ? (
          <motion.div
            className="fixed bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(18px,env(safe-area-inset-right))] z-40"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.94 }}
            transition={reduceMotion ? { duration: 0.12 } : SPRING_PANEL}
          >
            <Button
              variant="secondary"
              size="sm"
              ripple
              aria-label="Back to top"
              data-beui-tooltip="Back to top"
              className="glass-thin h-10 gap-1.5 border-border px-3.5 shadow-lg"
              onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })}
            >
              <ArrowUp className="size-3.5" aria-hidden="true" />
              <span>Top</span>
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
