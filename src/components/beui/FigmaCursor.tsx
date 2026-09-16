import { useEffect, useRef } from 'react';

interface FigmaCursorPoint {
  x: number;
  y: number;
}

interface FigmaCursorProps {
  name?: string;
  color?: string;
  tagTextColor?: string;
  size?: number;
  corner?: number;
  ease?: number;
  point?: FigmaCursorPoint;
}

export function FigmaCursor({
  name = 'you',
  color = 'var(--foreground)',
  tagTextColor = 'var(--background)',
  size = 22,
  corner = 1.75,
  ease = 0.34,
  point,
}: FigmaCursorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const remote = Boolean(point);
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!remote && (!finePointer || reduceMotion)) {
      node.style.display = 'none';
      return;
    }

    const style = document.createElement('style');
    if (!remote) {
      style.dataset.figmaCursor = 'true';
      style.textContent = `
        @media (hover: hover) and (pointer: fine) {
          html[data-figma-cursor='on'],
          html[data-figma-cursor='on'] body,
          html[data-figma-cursor='on'] body * {
            cursor: none !important;
          }
        }
      `;
      document.head.appendChild(style);
      document.documentElement.dataset.figmaCursor = 'on';
    }

    let mx = point?.x ?? 0;
    let my = point?.y ?? 0;
    let x = mx;
    let y = my;
    let frame = 0;
    let visible = remote;

    const move = (event: PointerEvent) => {
      mx = event.clientX;
      my = event.clientY;
      if (!visible) {
        visible = true;
        node.style.opacity = '1';
      }
    };

    if (!remote) {
      window.addEventListener('pointermove', move, { passive: true });
    } else {
      node.style.opacity = '1';
    }

    const loop = () => {
      if (point) {
        mx = point.x;
        my = point.y;
      }
      x += (mx - x) * ease;
      y += (my - y) * ease;
      node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => {
      if (!remote) {
        window.removeEventListener('pointermove', move);
        delete document.documentElement.dataset.figmaCursor;
        style.remove();
      }
      cancelAnimationFrame(frame);
    };
  }, [ease, point]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        willChange: 'transform',
        opacity: 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ overflow: 'visible' }}>
        <path
          d="M5 2l14 7-6 1.7L11 18z"
          fill={color}
          stroke={color}
          strokeWidth={corner * 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          top: 16,
          left: 14,
          padding: '2px 7px',
          borderRadius: 999,
          background: color,
          color: tagTextColor,
          font: '400 10px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgb(0 0 0 / 0.18)',
        }}
      >
        {name}
      </span>
    </div>
  );
}

export default FigmaCursor;
