import { ArrowRight, Menu, Search, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../motion/button';
import { Input } from '../motion/input';
import { ThemeToggle } from '../motion/theme-toggle';
import { SPRING_LAYOUT, SPRING_PANEL } from '../../lib/ease';
import TooltipLayer from './TooltipLayer';
import '../../styles/beui-dark-mode.css';

interface SiteHeaderProps {
  homeUrl: string;
  emojisUrl: string;
  categoriesUrl: string;
  routePath: string;
}

export default function SiteHeader({ homeUrl, emojisUrl, categoriesUrl, routePath }: SiteHeaderProps) {
  const reduceMotion = useReducedMotion();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navPreviewHref, setNavPreviewHref] = useState<string | null>(null);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const rootUrl = homeUrl.replace(/\/$/, '');
  const kitchenUrl = `${rootUrl}/kitchen`;
  const favoritesUrl = `${rootUrl}/favorites`;

  const nav = useMemo(() => [
    { label: 'Home', href: homeUrl, active: routePath === '/' },
    { label: 'Browse', href: emojisUrl, active: routePath === '/emojis' || routePath.startsWith('/emoji/') },
    { label: 'Categories', href: categoriesUrl, active: routePath === '/categories' || routePath.startsWith('/categories/') },
    { label: 'Kitchen', href: kitchenUrl, active: routePath === '/kitchen' },
    { label: 'My Emoji', href: favoritesUrl, active: ['/favorites', '/recent', '/packs'].includes(routePath), count: favoriteCount }
  ], [homeUrl, emojisUrl, categoriesUrl, kitchenUrl, favoritesUrl, routePath, favoriteCount]);

  const activeNavHref = nav.find((item) => item.active)?.href ?? null;
  const highlightedNavHref = navPreviewHref ?? activeNavHref;

  useEffect(() => {
    if (!searchOpen) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen && !menuOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [searchOpen, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    const storageKey = 'eplus-emoji-favorites-v1';
    const updateCount = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
        setFavoriteCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch {
        setFavoriteCount(0);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) updateCount();
    };
    updateCount();
    window.addEventListener('storage', onStorage);
    document.addEventListener('eplus:favorites-changed', updateCount);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('eplus:favorites-changed', updateCount);
    };
  }, []);

  const panelTransition = reduceMotion ? { duration: 0.12 } : SPRING_PANEL;

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
    >
      <TooltipLayer />
      <div className="shell relative flex min-h-16 items-center gap-3">
        <motion.a
          href={homeUrl}
          aria-label="ePlus Emoji home"
          className="group flex min-w-0 items-center gap-2.5 no-underline"
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          transition={SPRING_LAYOUT}
        >
          <motion.span
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-sm text-primary-foreground shadow-sm"
            whileHover={reduceMotion ? undefined : { rotate: -4, scale: 1.04 }}
            transition={SPRING_LAYOUT}
            aria-hidden="true"
          >
            😀
          </motion.span>
          <span className="hidden min-w-0 leading-none sm:grid">
            <strong className="truncate text-[.88rem] font-semibold tracking-[-.02em] text-foreground">ePlus Emoji</strong>
            <small className="mt-1 truncate text-[.6rem] font-medium text-muted-foreground">Open emoji directory</small>
          </span>
        </motion.a>

        <nav
          className="mx-auto hidden items-center rounded-full border border-border bg-card p-1 md:flex"
          aria-label="Primary navigation"
          onPointerLeave={() => setNavPreviewHref(null)}
        >
          {nav.map((item) => {
            const highlighted = highlightedNavHref === item.href;
            const previewing = navPreviewHref === item.href && !item.active;

            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                onPointerEnter={() => setNavPreviewHref(item.href)}
                onFocus={() => setNavPreviewHref(item.href)}
                onBlur={() => setNavPreviewHref(null)}
                className="relative flex h-8 items-center rounded-full px-3.5 text-xs font-medium no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {highlighted ? (
                  <motion.span
                    layoutId="beui-header-nav-pill"
                    className={`absolute inset-0 z-0 rounded-full border border-border shadow-sm ${previewing ? 'bg-background/75' : 'bg-background'}`}
                    transition={reduceMotion ? { duration: 0 } : SPRING_LAYOUT}
                    aria-hidden="true"
                  />
                ) : null}
                <motion.span
                  className="relative z-10 flex items-center gap-1.5"
                  animate={{
                    color: highlighted ? 'var(--foreground)' : 'var(--muted-foreground)',
                    y: highlighted && !reduceMotion ? -0.25 : 0
                  }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.16 }}
                >
                  <span>{item.label}</span>
                  {'count' in item && item.count > 0 ? (
                    <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[.55rem] font-bold leading-none text-background">
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  ) : null}
                </motion.span>
              </a>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <ThemeToggle
            variant="circle-blur"
            start="top-right"
            className="size-9 rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            iconClassName="size-4"
          />
          <Button
            variant="secondary"
            size="icon"
            ripple
            data-header-search-toggle
            aria-label="Search emoji"
            aria-expanded={searchOpen}
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen((value) => !value);
            }}
            className="size-9 rounded-full"
          >
            <Search className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            ripple
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            onClick={() => {
              setSearchOpen(false);
              setMenuOpen((value) => !value);
            }}
            className="size-9 rounded-full md:hidden"
          >
            {menuOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
          </Button>
        </div>

        <AnimatePresence>
          {searchOpen ? (
            <motion.div
              className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 mx-auto w-[min(620px,calc(100vw-24px))]"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
              transition={panelTransition}
            >
              <form
                action={emojisUrl}
                method="get"
                role="search"
                className="glass flex items-center gap-2 rounded-2xl p-2 shadow-xl"
              >
                <Input
                  ref={inputRef}
                  name="q"
                  type="search"
                  autoComplete="off"
                  aria-label="Search emoji"
                  placeholder="Search emoji, tag or category"
                  leftIcon={<Search aria-hidden="true" />}
                  className="min-w-0 flex-1"
                  classNames={{
                    field: '!h-10 !border-border !bg-background/90 !shadow-sm',
                    input: 'text-sm'
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  ripple
                  className="shrink-0 !border !border-primary !bg-primary !text-primary-foreground !shadow-sm hover:!bg-primary/90"
                >
                  Search
                </Button>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              className="fixed inset-x-0 bottom-0 top-16 z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.16 }}
            >
              <button
                type="button"
                aria-label="Close navigation"
                className="absolute inset-0 appearance-none border-0 bg-background/72 p-0 backdrop-blur-[2px]"
                onClick={() => setMenuOpen(false)}
              />
              <motion.nav
                aria-label="Mobile navigation"
                className="absolute left-3 right-3 top-2 z-10 grid gap-1.5 rounded-2xl border border-border bg-background p-2.5 shadow-2xl"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
                transition={panelTransition}
              >
                {nav.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? 'page' : undefined}
                    className={`flex min-h-12 items-center justify-between rounded-xl px-3.5 text-sm font-medium no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${item.active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-transparent text-foreground hover:bg-muted'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {'count' in item && item.count > 0 ? (
                        <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[.58rem] font-bold leading-none text-background">
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </motion.nav>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
