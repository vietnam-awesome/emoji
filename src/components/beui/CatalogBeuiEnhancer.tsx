import { Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Button } from '../motion/button';
import { Input } from '../motion/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../motion/select';
import { Tabs, TabsList, TabsTrigger } from '../motion/tabs';

type SelectSnapshot = {
  value: string;
  disabled: boolean;
  label: string;
  options: Array<{ value: string; label: string; disabled: boolean }>;
};

type SelectMount = {
  proxy: HTMLSelectElement;
  host: HTMLDivElement;
};

type ModeMount = {
  proxy: HTMLElement;
  host: HTMLDivElement;
  proxyButtons: HTMLButtonElement[];
};

type SearchMount = {
  proxy: HTMLInputElement;
  shell: HTMLElement;
  host: HTMLDivElement;
  submitProxy: HTMLButtonElement | null;
};

function readSelect(proxy: HTMLSelectElement): SelectSnapshot {
  return {
    value: proxy.value,
    disabled: proxy.disabled,
    label: proxy.getAttribute('aria-label') || 'Select filter',
    options: Array.from(proxy.options).map((option) => ({
      value: option.value,
      label: option.textContent?.trim() || option.label || option.value,
      disabled: option.disabled,
    })),
  };
}

function SelectAdapter({ proxy }: { proxy: HTMLSelectElement }) {
  const [snapshot, setSnapshot] = useState<SelectSnapshot>(() => readSelect(proxy));

  useEffect(() => {
    const sync = () => setSnapshot(readSelect(proxy));
    const observer = new MutationObserver(sync);
    observer.observe(proxy, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    proxy.addEventListener('change', sync);
    return () => {
      observer.disconnect();
      proxy.removeEventListener('change', sync);
    };
  }, [proxy]);

  return (
    <Select
      value={snapshot.value}
      disabled={snapshot.disabled}
      onValueChange={(value) => {
        if (proxy.value === value) return;
        proxy.value = value;
        proxy.dispatchEvent(new Event('change', { bubbles: true }));
      }}
      className="w-full"
    >
      <SelectTrigger className="h-10 w-full bg-background shadow-sm" aria-label={snapshot.label}>
        <SelectValue placeholder={snapshot.label} />
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

function SearchAdapter({ proxy, submitProxy }: Pick<SearchMount, 'proxy' | 'submitProxy'>) {
  const [value, setValue] = useState(proxy.value);
  const [busy, setBusy] = useState(Boolean(submitProxy?.classList.contains('is-loading')));

  useEffect(() => {
    const syncValue = () => setValue(proxy.value);
    proxy.addEventListener('input', syncValue);
    proxy.addEventListener('change', syncValue);
    const timer = window.setInterval(syncValue, 250);

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
      window.clearInterval(timer);
      observer?.disconnect();
    };
  }, [proxy, submitProxy]);

  const syncProxy = (next: string) => {
    setValue(next);
    proxy.value = next;
    proxy.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <Input
        type="search"
        value={value}
        onChange={syncProxy}
        placeholder={proxy.placeholder || 'Search'}
        aria-label={proxy.getAttribute('aria-label') || 'Search emoji'}
        data-beui-visible-search={proxy.id}
        leftIcon={<Search aria-hidden="true" />}
        className="min-w-0 flex-1"
        classNames={{
          field: 'h-11 border-border bg-background shadow-sm',
          input: 'text-sm'
        }}
      />
      {submitProxy ? (
        <Button
          type="submit"
          variant="secondary"
          ripple
          disabled={busy}
          className="h-11 shrink-0 bg-background px-5 shadow-sm hover:bg-card"
        >
          {busy ? 'Searching…' : 'Search'}
        </Button>
      ) : null}
    </div>
  );
}

function readMode(proxy: HTMLElement) {
  const buttons = Array.from(proxy.querySelectorAll<HTMLButtonElement>('[data-browse-mode]'));
  return buttons.find((button) => button.getAttribute('aria-pressed') === 'true')?.dataset.browseMode
    || buttons.find((button) => button.classList.contains('is-active'))?.dataset.browseMode
    || 'scroll';
}

function BrowseModeAdapter({ proxy }: { proxy: HTMLElement }) {
  const [mode, setMode] = useState(() => readMode(proxy));

  useEffect(() => {
    const sync = () => setMode(readMode(proxy));
    const observer = new MutationObserver(sync);
    observer.observe(proxy, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-pressed'] });
    proxy.addEventListener('click', sync);
    return () => {
      observer.disconnect();
      proxy.removeEventListener('click', sync);
    };
  }, [proxy]);

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        const button = proxy.querySelector<HTMLButtonElement>(`[data-browse-mode="${value}"]`);
        button?.click();
      }}
      variant="segment"
    >
      <TabsList aria-label="Choose how emoji are loaded" className="border border-border bg-card shadow-sm">
        <TabsTrigger value="scroll">Scroll</TabsTrigger>
        <TabsTrigger value="pagination">Pages</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default function CatalogBeuiEnhancer() {
  const [selectMounts, setSelectMounts] = useState<SelectMount[]>([]);
  const [modeMounts, setModeMounts] = useState<ModeMount[]>([]);
  const [searchMounts, setSearchMounts] = useState<SearchMount[]>([]);

  useEffect(() => {
    const createdHosts: HTMLElement[] = [];

    const selects = Array.from(document.querySelectorAll<HTMLSelectElement>(
      '#category-filter, #source-filter, #motion-filter',
    ));
    const nextSelectMounts = selects.map((proxy) => {
      proxy.classList.add('beui-native-proxy');
      proxy.setAttribute('aria-hidden', 'true');
      proxy.tabIndex = -1;

      const host = document.createElement('div');
      host.className = 'beui-control-host';
      host.dataset.forControl = proxy.id;
      proxy.insertAdjacentElement('afterend', host);
      createdHosts.push(host);
      return { proxy, host };
    });

    const modeSwitchers = Array.from(document.querySelectorAll<HTMLElement>('.browse-mode-switcher'));
    const nextModeMounts = modeSwitchers.map((proxy, index) => {
      const proxyButtons = Array.from(proxy.querySelectorAll<HTMLButtonElement>('[data-browse-mode]'));
      proxy.classList.add('beui-native-proxy');
      proxy.setAttribute('aria-hidden', 'true');
      proxyButtons.forEach((button) => { button.tabIndex = -1; });

      const host = document.createElement('div');
      host.className = 'beui-control-host beui-mode-host';
      host.dataset.modeHost = String(index);
      proxy.insertAdjacentElement('afterend', host);
      createdHosts.push(host);
      return { proxy, host, proxyButtons };
    });

    const searchInputs = Array.from(document.querySelectorAll<HTMLInputElement>('#emoji-search, #category-search'));
    const nextSearchMounts = searchInputs.flatMap((proxy) => {
      const shell = proxy.closest<HTMLElement>('.catalog-search, .category-search');
      if (!shell) return [];

      const submitProxy = shell.querySelector<HTMLButtonElement>('.catalog-search-submit');
      shell.classList.add('beui-native-proxy-block');
      shell.setAttribute('aria-hidden', 'true');
      proxy.tabIndex = -1;
      if (submitProxy) submitProxy.tabIndex = -1;

      const host = document.createElement('div');
      host.className = `beui-search-host ${proxy.id === 'emoji-search' ? 'beui-catalog-search-host' : 'beui-category-search-host'}`;
      host.dataset.forControl = proxy.id;
      shell.insertAdjacentElement('afterend', host);
      createdHosts.push(host);
      return [{ proxy, shell, host, submitProxy }];
    });

    setSelectMounts(nextSelectMounts);
    setModeMounts(nextModeMounts);
    setSearchMounts(nextSearchMounts);

    return () => {
      for (const { proxy } of nextSelectMounts) {
        proxy.classList.remove('beui-native-proxy');
        proxy.removeAttribute('aria-hidden');
        proxy.tabIndex = 0;
      }
      for (const { proxy, proxyButtons } of nextModeMounts) {
        proxy.classList.remove('beui-native-proxy');
        proxy.removeAttribute('aria-hidden');
        proxyButtons.forEach((button) => { button.tabIndex = 0; });
      }
      for (const { proxy, shell, submitProxy } of nextSearchMounts) {
        shell.classList.remove('beui-native-proxy-block');
        shell.removeAttribute('aria-hidden');
        proxy.tabIndex = 0;
        if (submitProxy) submitProxy.tabIndex = 0;
      }
      createdHosts.forEach((host) => host.remove());
    };
  }, []);

  return (
    <>
      {selectMounts.map(({ proxy, host }) =>
        createPortal(<SelectAdapter proxy={proxy} />, host, `select-${proxy.id}`),
      )}
      {modeMounts.map(({ proxy, host }, index) =>
        createPortal(<BrowseModeAdapter proxy={proxy} />, host, `mode-${index}`),
      )}
      {searchMounts.map(({ proxy, host, submitProxy }) =>
        createPortal(<SearchAdapter proxy={proxy} submitProxy={submitProxy} />, host, `search-${proxy.id}`),
      )}
    </>
  );
}
