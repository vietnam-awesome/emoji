"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ButtonLink } from "../motion/button";
import { Marquee } from "../motion/marquee";

export type NotFoundEmoji = {
  name: string;
  image: string;
  href: string;
  animated?: boolean;
};

type Props = {
  homeHref: string;
  browseHref: string;
  items: NotFoundEmoji[];
  visibleCount?: number;
  searchManifestHref: string;
  searchChunksHref: string;
  detailBaseHref: string;
};

type SearchManifest = { chunkCount?: number };
type CompactEmoji = { s?: string; n?: string; i?: string; a?: boolean };

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$?/\\";

function shuffledCopy<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function Scramble({ text }: { text: string }) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(text);

  useEffect(() => {
    if (reduceMotion) {
      setValue(text);
      return;
    }

    const characters = text.split("");
    const startedAt = performance.now();
    let frame = 0;
    let lastTick = 0;

    const render = (now: number) => {
      if (now - lastTick >= 45) {
        lastTick = now;
        const progress = Math.min((now - startedAt) / 700, 1);
        const settled = Math.floor(progress * characters.length);
        setValue(
          characters
            .map((character, index) =>
              index < settled || character === " "
                ? character
                : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
            )
            .join(""),
        );
      }

      if (now - startedAt < 700) frame = requestAnimationFrame(render);
      else setValue(text);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, text]);

  return <span className="tabular-nums">{value}</span>;
}

function EmojiTile({ item }: { item: NotFoundEmoji }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <a
      href={item.href}
      aria-label={`Open ${item.name}`}
      className="group/item relative grid size-20 place-items-center overflow-hidden rounded-2xl border border-border bg-card/85 shadow-sm transition-[transform,border-color,background] duration-200 hover:-translate-y-1 hover:border-border-strong hover:bg-background sm:size-24"
    >
      {!loaded ? <span className="not-found-image-skeleton" aria-hidden="true" /> : null}
      <img
        src={item.image}
        alt=""
        width={64}
        height={64}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`relative z-[2] size-12 object-contain transition-[opacity,transform] duration-200 group-hover/item:scale-105 sm:size-14 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
      {item.animated ? (
        <span className="absolute right-2 top-2 rounded-full bg-primary px-1.5 py-0.5 text-[.46rem] font-extrabold tracking-[.06em] text-primary-foreground">
          GIF
        </span>
      ) : null}
    </a>
  );
}

export default function NotFoundExperience({
  homeHref,
  browseHref,
  items,
  visibleCount = 48,
  searchManifestHref,
  searchChunksHref,
  detailBaseHref,
}: Props) {
  const targetCount = Math.max(0, visibleCount);
  const fallbackCount = Math.min(targetCount, items.length);
  const [visibleItems, setVisibleItems] = useState(() => items.slice(0, fallbackCount));

  useEffect(() => {
    let cancelled = false;
    setVisibleItems(shuffledCopy(items).slice(0, fallbackCount));

    const loadRandomChunk = async () => {
      try {
        const manifestResponse = await fetch(searchManifestHref, { cache: "no-store" });
        if (!manifestResponse.ok) return;
        const manifest = (await manifestResponse.json()) as SearchManifest;
        const chunkCount = Math.floor(Number(manifest.chunkCount || 0));
        if (chunkCount < 1) return;

        const chunkIndex = Math.floor(Math.random() * chunkCount);
        const chunkFile = `${String(chunkIndex).padStart(4, "0")}.json`;
        const chunkUrl = `${searchChunksHref.replace(/\/$/, "")}/${chunkFile}`;
        const chunkResponse = await fetch(chunkUrl, { cache: "no-store" });
        if (!chunkResponse.ok) return;
        const rows = (await chunkResponse.json()) as CompactEmoji[];
        if (!Array.isArray(rows)) return;

        const detailBase = detailBaseHref.replace(/\/$/, "");
        const candidates = rows
          .filter((row) => row?.s && row?.i)
          .map((row) => ({
            name: String(row.n || row.s),
            image: String(row.i),
            href: `${detailBase}/${encodeURIComponent(String(row.s))}`,
            animated: Boolean(row.a),
          }));

        const next = shuffledCopy(candidates).slice(0, targetCount);
        if (!cancelled && next.length > 0) setVisibleItems(next);
      } catch {
        // Keep the build-time fallback when search assets are unavailable.
      }
    };

    void loadRandomChunk();
    return () => {
      cancelled = true;
    };
  }, [detailBaseHref, fallbackCount, items, searchChunksHref, searchManifestHref, targetCount]);

  const rows = useMemo(() => {
    const midpoint = Math.max(1, Math.ceil(visibleItems.length / 2));
    return [visibleItems.slice(0, midpoint), visibleItems.slice(midpoint)];
  }, [visibleItems]);

  return (
    <section className="overflow-hidden py-10 sm:py-14 lg:py-16">
      <div className="shell">
        <div className="mx-auto flex min-h-[430px] max-w-3xl flex-col items-center justify-center gap-8 px-4 text-center">
          <div className="group relative select-none font-mono font-bold leading-none tracking-tighter text-foreground [font-size:clamp(6rem,20vw,12rem)]">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 translate-x-0 text-[#ff0040] opacity-0 mix-blend-screen transition-[transform,opacity] duration-150 group-hover:translate-x-[3px] group-hover:opacity-65 motion-reduce:hidden"
            >
              <Scramble text="404" />
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 text-[#00e5ff] opacity-0 mix-blend-screen transition-[transform,opacity] duration-150 group-hover:-translate-x-[3px] group-hover:opacity-65 motion-reduce:hidden"
            >
              <Scramble text="404" />
            </span>
            <h1 className="relative m-0">
              <Scramble text="404" />
            </h1>
          </div>

          <div className="flex max-w-xl flex-col items-center gap-2">
            <p className="m-0 text-lg font-semibold text-foreground sm:text-xl">Emoji not found</p>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              This page may have moved, been removed, or never existed. Try the library instead — there are plenty of emoji still roaming around.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={homeHref} variant="primary" size="md" className="gap-2 no-underline">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back home
            </ButtonLink>
            <ButtonLink href={browseHref} variant="secondary" size="md" className="gap-2 no-underline">
              <Search className="size-4" aria-hidden="true" />
              Browse emoji
            </ButtonLink>
          </div>
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <div className="mt-3 grid gap-3 border-y border-border bg-card/35 py-5 sm:mt-6 sm:py-6">
          <Marquee speed={34} gap="0.75rem" className="w-full">
            {rows[0].map((item) => <EmojiTile key={item.href} item={item} />)}
          </Marquee>
          {rows[1].length > 0 ? (
            <Marquee direction="right" speed={38} gap="0.75rem" className="w-full">
              {rows[1].map((item) => <EmojiTile key={item.href} item={item} />)}
            </Marquee>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
