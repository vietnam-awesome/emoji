import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Button } from '../motion/button';
import { SPRING_PANEL } from '../../lib/ease';
import FigmaCursor from './FigmaCursor';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setVisible(window.scrollY >= Math.max(560, window.innerHeight * 0.72));
      });
    };
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
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
