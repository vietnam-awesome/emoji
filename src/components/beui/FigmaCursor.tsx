import { useEffect, useRef } from 'react';

interface FigmaCursorPoint {
  x: number;
  y: number;
}

type CursorState = 'default' | 'click' | 'type' | 'drag' | 'selected' | 'disabled';

interface FigmaCursorProps {
  name?: string;
  color?: string;
  tagTextColor?: string;
  size?: number;
  corner?: number;
  ease?: number;
  point?: FigmaCursorPoint;
}

const CLICK_SELECTOR = [
  'a[href]',
  'button',
  'summary',
  'select',
  'label[for]',
  '[role="button"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="file"]',
  'input[type="range"]',
].join(',');

const TYPE_SELECTOR = [
  'textarea',
  '[contenteditable="true"]',
  'input:not([type])',
  'input[type="text"]',
  'input[type="search"]',
  'input[type="email"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input[type="password"]',
  'input[type="number"]',
].join(',');

const TOP_LAYER_SELECTOR = 'dialog:modal, [popover]:popover-open';

/**
 * Optional per-element overrides:
 * data-cursor="click|type|drag|selected|disabled|default"
 * data-cursor-label="custom label"
 */
function readCursorState(target: Element | null): { state: CursorState; label?: string } {
  if (!target) return { state: 'default' };

  const disabled = target.closest<HTMLElement>(
    ':disabled, [aria-disabled="true"], [data-disabled="true"], [inert], [data-cursor="disabled"]',
  );
  if (disabled) return { state: 'disabled', label: disabled.dataset.cursorLabel };

  const override = target.closest<HTMLElement>('[data-cursor]');
  const overrideState = override?.dataset.cursor as CursorState | undefined;
  const overrideLabel = override?.dataset.cursorLabel;
  if (overrideState && ['default', 'click', 'type', 'drag', 'selected'].includes(overrideState)) {
    return { state: overrideState, label: overrideLabel };
  }

  const typeTarget = target.closest<HTMLElement>(TYPE_SELECTOR);
  if (typeTarget) return { state: 'type', label: typeTarget.dataset.cursorLabel };

  const selected = target.closest<HTMLElement>(
    '[aria-selected="true"], [aria-pressed="true"], [aria-current="page"], input:checked',
  );
  if (selected) return { state: 'selected', label: selected.dataset.cursorLabel };

  const dragTarget = target.closest<HTMLElement>('[draggable="true"], [data-drag-handle], [data-cursor="drag"]');
  if (dragTarget) return { state: 'drag', label: dragTarget.dataset.cursorLabel };

  const clickTarget = target.closest<HTMLElement>(CLICK_SELECTOR);
  if (clickTarget) return { state: 'click', label: clickTarget.dataset.cursorLabel };

  return { state: 'default' };
}

function hasTopLayerSurface() {
  try {
    return document.querySelector(TOP_LAYER_SELECTOR) !== null;
  } catch {
    // Older browsers might not understand :modal / :popover-open. A visible dialog
    // still needs the native cursor because it can sit in the browser top layer.
    return document.querySelector('dialog[open]') !== null;
  }
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
  const innerRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    const inner = innerRef.current;
    const tag = tagRef.current;
    if (!node || !inner || !tag) return;

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
    let pressed = false;
    let suspended = false;
    let state: CursorState = 'default';
    let customLabel: string | undefined;

    const labels: Record<CursorState, string> = {
      default: name,
      click: 'click',
      type: 'type',
      drag: 'drag',
      selected: 'selected',
      disabled: 'disabled',
    };

    const applyState = () => {
      const scaleByState: Record<CursorState, number> = {
        default: 1,
        click: 1.12,
        type: 0.9,
        drag: 1.16,
        selected: 1.08,
        disabled: 0.92,
      };
      const rotationByState: Record<CursorState, number> = {
        default: 0,
        click: -3,
        type: 1,
        drag: -7,
        selected: -2,
        disabled: 0,
      };

      const pressScale = pressed && state !== 'disabled' ? 0.82 : 1;
      inner.style.transform = `scale(${scaleByState[state] * pressScale}) rotate(${rotationByState[state]}deg)`;
      inner.style.opacity = state === 'disabled' ? '0.42' : '1';
      inner.style.filter = state === 'disabled' ? 'grayscale(1)' : 'none';
      tag.textContent = customLabel || labels[state];
      tag.style.opacity = state === 'disabled' ? '0.72' : '1';
      tag.style.transform = pressed && state !== 'disabled' ? 'translateY(1px) scale(.96)' : 'translateY(0) scale(1)';
      tag.style.outline = state === 'selected' ? '1px solid color-mix(in srgb, currentColor 28%, transparent)' : 'none';
      tag.style.outlineOffset = state === 'selected' ? '2px' : '0';
    };

    const updateTargetState = (target: EventTarget | null) => {
      if (remote) return;
      const element = target instanceof Element ? target : null;
      const next = readCursorState(element);
      if (next.state === state && next.label === customLabel) return;
      state = next.state;
      customLabel = next.label;
      applyState();
    };

    const syncTopLayerMode = () => {
      if (remote) return;
      const nextSuspended = hasTopLayerSurface();
      if (nextSuspended === suspended) return;

      suspended = nextSuspended;
      if (suspended) {
        delete document.documentElement.dataset.figmaCursor;
        node.style.opacity = '0';
        return;
      }

      document.documentElement.dataset.figmaCursor = 'on';
      node.style.opacity = visible ? '1' : '0';
    };

    const move = (event: PointerEvent) => {
      mx = event.clientX;
      my = event.clientY;
      updateTargetState(event.target);
      if (!visible) visible = true;
      if (!suspended) node.style.opacity = '1';
    };

    const down = (event: PointerEvent) => {
      pressed = true;
      updateTargetState(event.target);
      applyState();
    };

    const up = (event: PointerEvent) => {
      pressed = false;
      updateTargetState(event.target);
      applyState();
    };

    const leave = () => {
      if (remote) return;
      visible = false;
      node.style.opacity = '0';
    };

    let topLayerObserver: MutationObserver | undefined;
    const onTopLayerToggle = () => window.requestAnimationFrame(syncTopLayerMode);

    if (!remote) {
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerdown', down, { passive: true });
      window.addEventListener('pointerup', up, { passive: true });
      document.documentElement.addEventListener('mouseleave', leave);
      document.addEventListener('toggle', onTopLayerToggle, true);
      document.addEventListener('close', onTopLayerToggle, true);
      document.addEventListener('cancel', onTopLayerToggle, true);

      topLayerObserver = new MutationObserver(syncTopLayerMode);
      topLayerObserver.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['open'],
      });
      syncTopLayerMode();
    } else {
      node.style.opacity = '1';
    }

    applyState();

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
        window.removeEventListener('pointerdown', down);
        window.removeEventListener('pointerup', up);
        document.documentElement.removeEventListener('mouseleave', leave);
        document.removeEventListener('toggle', onTopLayerToggle, true);
        document.removeEventListener('close', onTopLayerToggle, true);
        document.removeEventListener('cancel', onTopLayerToggle, true);
        topLayerObserver?.disconnect();
        delete document.documentElement.dataset.figmaCursor;
        style.remove();
      }
      cancelAnimationFrame(frame);
    };
  }, [ease, name, point]);

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
        transition: 'opacity 140ms ease',
      }}
    >
      <div
        ref={innerRef}
        style={{
          position: 'relative',
          transformOrigin: '4px 2px',
          transition: 'transform 150ms cubic-bezier(.2,.8,.2,1), opacity 150ms ease, filter 150ms ease',
          willChange: 'transform',
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
          ref={tagRef}
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
            transformOrigin: 'left center',
            transition: 'transform 120ms ease, opacity 120ms ease, outline-color 120ms ease',
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

export default FigmaCursor;
