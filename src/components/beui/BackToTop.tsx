import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { SPRING_PRESS } from '../../lib/ease';

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
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-[max(18px,env(safe-area-inset-bottom))] right-[max(18px,env(safe-area-inset-right))] z-40 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--line-strong)] bg-white/90 px-3.5 text-[.72rem] font-bold text-[var(--ink-soft)] shadow-[0_12px_32px_rgba(16,24,40,.14)] backdrop-blur-xl"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.92 }}
          whileHover={reduceMotion ? undefined : { y: -2 }}
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          transition={reduceMotion ? { duration: 0.12 } : SPRING_PRESS}
          onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })}
        >
          <svg className="size-3.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 14.5 5.5-5.5 5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Top</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
