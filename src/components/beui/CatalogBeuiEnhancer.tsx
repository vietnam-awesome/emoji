import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
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
};

function readSelect(proxy: HTMLSelectElement): SelectSnapshot {
  const selected = proxy.options[proxy.selectedIndex];
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
      <SelectContent className="max-h-72 overflow-auto">
        {snapshot.options.map((option) => (
          <SelectItem key={option.value || '__all__'} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
      proxy.classList.add('beui-native-proxy');
      proxy.setAttribute('aria-hidden', 'true');

      const host = document.createElement('div');
      host.className = 'beui-control-host beui-mode-host';
      host.dataset.modeHost = String(index);
      proxy.insertAdjacentElement('afterend', host);
      createdHosts.push(host);
      return { proxy, host };
    });

    setSelectMounts(nextSelectMounts);
    setModeMounts(nextModeMounts);

    return () => {
      for (const { proxy } of nextSelectMounts) {
        proxy.classList.remove('beui-native-proxy');
        proxy.removeAttribute('aria-hidden');
        proxy.removeAttribute('tabindex');
      }
      for (const { proxy } of nextModeMounts) {
        proxy.classList.remove('beui-native-proxy');
        proxy.removeAttribute('aria-hidden');
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
    </>
  );
}
