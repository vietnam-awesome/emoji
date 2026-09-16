import { Children, type CSSProperties, type ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface MarqueeProps {
  children: ReactNode;
  direction?: "left" | "right" | "up" | "down";
  speed?: number;
  pauseOnHover?: boolean;
  gap?: string;
  className?: string;
  fade?: boolean;
}

export function Marquee({
  children,
  direction = "left",
  speed = 30,
  pauseOnHover = true,
  gap = "1rem",
  className,
  fade = true,
}: MarqueeProps) {
  const vertical = direction === "up" || direction === "down";
  const reverse = direction === "right" || direction === "down";
  const items = Children.toArray(children);

  return (
    <div
      className={cn(
        "group relative flex overflow-hidden",
        vertical ? "flex-col" : "flex-row",
        fade && !vertical && "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        fade && vertical && "[mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]",
        className,
      )}
      style={{ "--beui-marquee-gap": gap, gap } as CSSProperties}
    >
      <style>{`
        @keyframes beui-marquee-x {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-100% - var(--beui-marquee-gap))); }
        }
        @keyframes beui-marquee-y {
          from { transform: translateY(0); }
          to { transform: translateY(calc(-100% - var(--beui-marquee-gap))); }
        }
        .beui-marquee-track { animation-timing-function: linear; animation-iteration-count: infinite; }
        .group:hover .beui-marquee-pause { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .beui-marquee-track { animation: none !important; }
        }
      `}</style>
      {[0, 1].map((duplicate) => (
        <div
          key={duplicate}
          aria-hidden={duplicate === 1}
          className={cn(
            "beui-marquee-track flex shrink-0 items-center",
            vertical ? "flex-col" : "flex-row",
            pauseOnHover && "beui-marquee-pause",
          )}
          style={{
            animationName: vertical ? "beui-marquee-y" : "beui-marquee-x",
            animationDuration: `${speed}s`,
            animationDirection: reverse ? "reverse" : "normal",
            gap,
          }}
        >
          {items.map((child, index) => (
            <div key={index} className="shrink-0">
              {child}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
