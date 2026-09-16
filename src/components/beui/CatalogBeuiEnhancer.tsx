"use client";

import { Database, Folder, LayoutGrid, List, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Button } from '../motion/button';
import { Input } from '../motion/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '../motion/select';
import { Tabs, TabsList, TabsTrigger } from '../motion/tabs';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectConfig = {
  proxyId: string;
  label: string;
  icon?: 'category' | 'source' | 'motion';
  options: SelectOption[];
  initialValue?: string;
};

type SearchConfig = {
  proxyId: string;
  placeholder: string;
  label: string;
  submitProxySelector?: string;
  showSubmit?: boolean;
  initialValue?: string;
};

type ModeConfig = {
  proxySelector: string;
  label: string;
  initialValue?: 'scroll' | 'pagination';
};

interface CatalogBeuiEnhancerProps {
  search?: SearchConfig;
  selects?: SelectConfig[];
  mode?: ModeConfig;
  clearProxyId?: string;
  className?: string;
}

type SelectSnapshot = {
  value: string;
  disabled: boolean;
  options: SelectOption[];
};

const selectIcons: Record<NonNullable<SelectConfig['icon']>, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  category: Folder,
  source: Database,
  motion: Sparkles,
};

function readSelect(proxy: HTMLSelectElement): SelectSnapshot {
  return {
    value: proxy.value,
    disabled: proxy.disabled,
    options: Array.from(proxy.options).map((option) => ({
      value: option.value,
      label: option.textContent?.trim() || option.label || option.value,
      disabled: option.disabled,
    })),
  };
}

function SelectControl({ config }: { config: SelectConfig }) {
  const [snapshot, setSnapshot] = useState<SelectSnapshot>({
    value: config.initialValue ?? '',
    disabled: false,
    options: config.options,
  });
  const Icon = config.icon ? selectIcons[config.icon] : null;
  const selectedLabel = snapshot.options.find((option) => option.value === snapshot.value)?.label ?? config.label;

  useEffect(() => {
    const proxy = document.getElementById(config.proxyId);
    if (!(proxy instanceof HTMLSelectElement)) return;

    const sync = () => setSnapshot(readSelect(proxy));
    const observer = new MutationObserver(sync);
    observer.observe(proxy, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    proxy.addEventListener('change', sync);
    sync();
    return () => {
      observer.disconnect();
      proxy.removeEventListener('change', sync);
    };
  }, [config.proxyId]);

  return (
    <Select
      value={snapshot.value}
      disabled={snapshot.disabled}
      onValueChange={(value) => {
        const proxy = document.getElementById(config.proxyId);
        if (!(proxy instanceof HTMLSelectElement) || proxy.value === value) return;
        proxy.value = value;
        proxy.dispatchEvent(new Event('change', { bubbles: true }));
      }}
      className="w-full"
    >
      <SelectTrigger className="h-10 w-full bg-background shadow-sm" aria-label={config.label}>
        <span className="flex min-w-0 items-center gap-2">
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden={true} /> : null}
          <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
        </span>
      </SelectTrigger>
      <SelectContent className="[&>div]:max-h-72 [&>div]:overflow-y-auto [&>div]:scrollbar-hide">
        {snapshot.options.map((option) => (
          <SelectItem key={option.value || '__all__'} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SearchControl({ config }: { config: SearchConfig }) {
  const [value, setValue] = useState(config.initialValue ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const proxy = document.getElementById(config.proxyId);
    if (!(proxy instanceof HTMLInputElement)) return;

    const syncValue = () => setValue(proxy.value);
    proxy.addEventListener('input', syncValue);
    proxy.addEventListener('change', syncValue);
    syncValue();

    const submitProxy = config.submitProxySelector
      ? document.querySelector<HTMLButtonElement>(config.submitProxySelector)
      : null;
    let observer: MutationObserver | undefined;
    if (submitProxy) {
      const syncBusy = () => setBusy(submitProxy.classList.contains('is-loading') || submitProxy.disabled);
      observer = new MutationObserver(syncBusy);
      observer.observe(submitProxy, { attributes: true, attributeFilter: ['class', 'disabled'] });
      syncBusy();
    }

    return () => {
      proxy.removeEventListener('input', syncValue);
      proxy.removeEventListener('change', syncValue);
      observer?.disconnect();
    };
  }, [config.proxyId, config.submitProxySelector]);

  const syncProxy = (next: string) => {
    setValue(next);
    const proxy = document.getElementById(config.proxyId);
    if (!(proxy instanceof HTMLInputElement)) return;
    proxy.value = next;
    proxy.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <Input
        type="search"
        value={value}
        onChange={syncProxy}
        placeholder={config.placeholder}
        aria-label={config.label}
        data-beui-visible-search={config.proxyId}
        leftIcon={<Search aria-hidden="true" />}
        className="min-w-0 flex-1"
        classNames={{
          field: '!h-11 !border-border !bg-background !shadow-sm',
          input: 'text-sm',
        }}
      />
      {config.showSubmit ? (
        <Button
          type="submit"
          variant="primary"
          ripple
          disabled={busy}
          className="h-11 shrink-0 !border !border-primary !bg-primary !px-5 !text-primary-foreground !shadow-sm hover:!bg-primary/90"
        >
          <Search className="size-4" aria-hidden="true" />
          <span>{busy ? 'Searching…' : 'Search'}</span>
        </Button>
      ) : null}
    </div>
  );
}

function ClearControl({ proxyId }: { proxyId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const proxy = document.getElementById(proxyId);
    if (!(proxy instanceof HTMLButtonElement)) return;
    const sync = () => setVisible(!proxy.hidden);
    const observer = new MutationObserver(sync);
    observer.observe(proxy, { attributes: true, attributeFilter: ['hidden'] });
    sync();
    return () => observer.disconnect();
  }, [proxyId]);

  if (!visible) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      ripple
      className="h-10 shrink-0 !border !border-border !bg-background !text-foreground !shadow-sm hover:!bg-card"
      onClick={() => document.getElementById(proxyId)?.click()}
    >
      <X className="size-3.5" aria-hidden="true" />
      <span>Clear</span>
    </Button>
  );
}

function readMode(proxy: HTMLElement) {
  const buttons = Array.from(proxy.querySelectorAll<HTMLButtonElement>('[data-browse-mode]'));
  return buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.browseMode
    || buttons.find((button) => button.classList.contains('is-active'))?.dataset.browseMode
    || 'scroll';
}

function ModeControl({ config }: { config: ModeConfig }) {
  const [mode, setMode] = useState(config.initialValue ?? 'scroll');

  useEffect(() => {
    const proxy = document.querySelector<HTMLElement>(config.proxySelector);
    if (!proxy) return;
    const sync = () => setMode(readMode(proxy));
    const observer = new MutationObserver(sync);
    observer.observe(proxy, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-pressed'] });
    proxy.addEventListener('click', sync);
    sync();
    return () => {
      observer.disconnect();
      proxy.removeEventListener('click', sync);
    };
  }, [config.proxySelector]);

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        const proxy = document.querySelector<HTMLElement>(config.proxySelector);
        const button = proxy?.querySelector<HTMLButtonElement>(`[data-browse-mode="${value}"]`);
        button?.click();
      }}
      variant="segment"
    >
      <TabsList aria-label={config.label} className="border border-border bg-card shadow-sm">
        <TabsTrigger value="scroll" className="gap-1.5">
          <List className="size-3.5" aria-hidden="true" />
          <span>Scroll</span>
        </TabsTrigger>
        <TabsTrigger value="pagination" className="gap-1.5">
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          <span>Pages</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default function CatalogBeuiEnhancer({ search, selects = [], mode, clearProxyId, className }: CatalogBeuiEnhancerProps) {
  const stableSelects = useMemo(() => selects, [selects]);

  return (
    <div className={className} data-beui-catalog-controls>
      {search ? <SearchControl config={search} /> : null}
      {stableSelects.length ? (
        <div className="beui-filter-grid">
          {stableSelects.map((config) => <SelectControl key={config.proxyId} config={config} />)}
          {clearProxyId ? <ClearControl proxyId={clearProxyId} /> : null}
        </div>
      ) : null}
      {mode ? <ModeControl config={mode} /> : null}
    </div>
  );
}
