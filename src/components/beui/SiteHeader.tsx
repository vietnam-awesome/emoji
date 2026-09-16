import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../motion/button';
import { SPRING_PRESS } from '../../lib/ease';

interface SiteHeaderProps {
  homeUrl: string;
  emojisUrl: string;
  categoriesUrl: string;
  routePath: string;
}

function SearchIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      ) : (
        <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function SiteHeader({ homeUrl, emojisUrl, categoriesUrl, routePath }: SiteHeaderProps) {
  const reduceMotion = useReducedMotion();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const nav = useMemo(() => [
    { label: 'Home', href: homeUrl, active: routePath === '/' },
    { label: 'Browse', href: emojisUrl, active: routePath === '/emojis' || routePath.startsWith('/emoji/') },
    { label: 'Categories', href: categoriesUrl, active: routePath === '/categories' || routePath.startsWith('/categories/') }
  ], [homeUrl, emojisUrl, categoriesUrl, routePath]);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
      }
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const pageSearch = document.querySelector<HTMLInputElement>('#emoji-search, #home-emoji-search, #category-search');
        if (pageSearch) return;
        event.preventDefault();
        setMenuOpen(false);
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const transition = reduceMotion ? { duration: 0.12 } : SPRING_PRESS;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80">
      <div className="shell relative flex min-h-16 items-center gap-3">
        <motion.a
          href={homeUrl}
          aria-label="ePlus Emoji home"
          className="group flex min-w-0 items-center gap-2.5 no-underline"
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          transition={transition}
        >
          <motion.span
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-black/10 bg-[#101828] text-sm shadow-[0_6px_18px_rgba(16,24,40,.18)]"
            whileHover={reduceMotion ? undefined : { rotate: -5, scale: 1.04 }}
            transition={transition}
            aria-hidden="true"
          >
            😀
          </motion.span>
          <span className="hidden min-w-0 leading-none sm:grid">
            <strong className="truncate text-[.88rem] font-[760] tracking-[-.02em] text-[var(--ink)]">ePlus Emoji</strong>
            <small className="mt-1 truncate text-[.58rem] font-semibold text-[var(--muted-light)]">Open emoji directory</small>
          </span>
        </motion.a>

        <nav className="mx-auto hidden items-center rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-1 md:flex" aria-label="Primary navigation">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className="relative isolate flex min-h-9 items-center rounded-lg px-3.5 text-[.76rem] font-[690] no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              {item.active ? (
                <motion.span
                  layoutId="beui-header-active"
                  className="absolute inset-0 -z-10 rounded-lg border border-[var(--line)] bg-white shadow-[0_1px_3px_rgba(16,24,40,.08)]"
                  transition={transition}
                />
              ) : null}
              <span className={item.active ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <Button
            variant="secondary"
            size="icon"
            data-header-search-toggle
            aria-label="Search emoji"
            aria-expanded={searchOpen}
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen((value) => !value);
            }}
            className="size-9 rounded-xl"
          >
            <SearchIcon />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            onClick={() => {
              setSearchOpen(false);
              setMenuOpen((value) => !value);
            }}
            className="size-9 rounded-xl md:hidden"
          >
            <MenuIcon open={menuOpen} />
          </Button>
        </div>

        <AnimatePresence>
          {searchOpen ? (
            <motion.div
              className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 mx-auto w-[min(620px,calc(100vw-24px))]"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
              transition={transition}
            >
              <form action={emojisUrl} method="get" role="search" className="flex items-center gap-2 rounded-2xl border border-[var(--line-strong)] bg-white p-2 pl-3 shadow-[0_22px_60px_rgba(16,24,40,.16)]">
                <SearchIcon className="size-[18px] shrink-0 text-[var(--muted-light)]" />
                <input
                  ref={inputRef}
                  name="q"
                  type="search"
                  autoComplete="off"
                  aria-label="Search emoji"
                  placeholder="Search emoji, tag or category"
                  className="min-h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted-light)]"
                />
                <Button type="submit" size="sm" className="rounded-xl px-4">Search</Button>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {menuOpen ? (
            <motion.nav
              aria-label="Mobile navigation"
              className="absolute left-0 right-0 top-[calc(100%+10px)] z-40 mx-auto grid w-[min(420px,calc(100vw-24px))] gap-1 rounded-2xl border border-[var(--line-strong)] bg-white p-2 shadow-[0_22px_60px_rgba(16,24,40,.16)] md:hidden"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
              transition={transition}
            >
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-[690] no-underline transition-colors ${item.active ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]'}`}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true">→</span>
                </a>
              ))}
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
