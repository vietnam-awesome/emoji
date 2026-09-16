import { ArrowRight, Menu, Search, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../motion/button';
import { Input } from '../motion/input';
import { SPRING_LAYOUT, SPRING_PANEL } from '../../lib/ease';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);

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

  const panelTransition = reduceMotion ? { duration: 0.12 } : SPRING_PANEL;

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
    >
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
        >
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className="relative isolate flex h-8 items-center rounded-full px-3.5 text-xs font-medium no-underline outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.active ? (
                <motion.span
                  layoutId="beui-header-active"
                  className="absolute inset-0 -z-10 rounded-full border border-border bg-background shadow-sm"
                  transition={reduceMotion ? { duration: 0 } : SPRING_LAYOUT}
                />
              ) : null}
              <span className={item.active ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
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
                  variant="secondary"
                  ripple
                  className="shrink-0 !border !border-border !bg-background !text-foreground !shadow-sm hover:!bg-card"
                >
                  Search
                </Button>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {menuOpen ? (
            <motion.nav
              aria-label="Mobile navigation"
              className="glass absolute left-0 right-0 top-[calc(100%+10px)] z-40 mx-auto grid w-[min(420px,calc(100vw-24px))] gap-1 rounded-2xl p-2 md:hidden"
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
                  className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-medium no-underline transition-colors ${item.active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              ))}
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
