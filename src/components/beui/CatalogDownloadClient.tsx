"use client";

import { Download, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../motion/button";

type SelectedItem = {
  key: string;
  name: string;
  url: string;
  filename: string;
};

const sanitizeFilename = (value: string) =>
  String(value || "emoji")
    .trim()
    .replace(/[<>:\"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 90) || "emoji";

const extensionFromUrl = (value: string) => {
  try {
    return new URL(value, window.location.href).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || "png";
  } catch {
    return "png";
  }
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const dosDateTime = (date = new Date()) => {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
};

const buildZip = (files: Array<{ name: string; data: Uint8Array }>) => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, localOffset, true);

    localParts.push(localHeader, nameBytes, data);
    centralParts.push(centralHeader, nameBytes);
    localOffset += localHeader.length + nameBytes.length + data.length;
  }

  const centralBytes = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localOffset, true);

  return new Blob([concatBytes([...localParts, centralBytes, end])], { type: "application/zip" });
};

const isSelectableCard = (node: Element): node is HTMLElement =>
  node instanceof HTMLElement &&
  node.matches(".emoji-card[data-emoji-card]") &&
  node.dataset.cardVariant !== "compact";

export default function CatalogDownloadClient() {
  const selectedRef = useRef(new Map<string, SelectedItem>());
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const cardItem = useCallback((card: HTMLElement): SelectedItem | null => {
    const image = card.querySelector(".emoji-preview img");
    const nameLink = card.querySelector(".emoji-name");
    if (!(image instanceof HTMLImageElement)) return null;

    const url = card.dataset.downloadUrl || image.currentSrc || image.src;
    const name = card.dataset.downloadName || nameLink?.textContent?.trim() || image.alt || "emoji";
    const key = card.dataset.downloadKey || nameLink?.getAttribute("href") || url;
    const filename = card.dataset.downloadFilename || `${sanitizeFilename(name)}.${extensionFromUrl(url)}`;
    return { key, name, url, filename };
  }, []);

  const syncCard = useCallback((card: HTMLElement) => {
    const item = cardItem(card);
    const input = card.querySelector("[data-emoji-select]");
    if (!item || !(input instanceof HTMLInputElement)) return;
    const checked = selectedRef.current.has(item.key);
    input.checked = checked;
    card.classList.toggle("is-selected", checked);
  }, [cardItem]);

  const ensureControls = useCallback((card: HTMLElement) => {
    if (!isSelectableCard(card)) return;
    const item = cardItem(card);
    if (!item) return;

    card.dataset.downloadKey ||= item.key;
    card.dataset.downloadName ||= item.name;
    card.dataset.downloadUrl ||= item.url;
    card.dataset.downloadFilename ||= item.filename;

    if (!card.querySelector("[data-emoji-select]")) {
      const selectLabel = document.createElement("label");
      selectLabel.className = "emoji-select-control !grid";
      selectLabel.title = `Select ${item.name}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.emojiSelect = "";
      checkbox.setAttribute("aria-label", `Select ${item.name}`);

      const checkmark = document.createElement("span");
      checkmark.setAttribute("aria-hidden", "true");
      checkmark.textContent = "✓";
      selectLabel.append(checkbox, checkmark);
      card.prepend(selectLabel);
    }

    if (!card.querySelector(".emoji-card-download")) {
      const directDownload = document.createElement("a");
      directDownload.className = "emoji-card-download";
      directDownload.href = item.url;
      directDownload.download = item.filename;
      directDownload.title = `Download ${item.name}`;
      directDownload.setAttribute("aria-label", `Download ${item.name}`);
      directDownload.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      card.prepend(directDownload);
    }

    syncCard(card);
  }, [cardItem, syncCard]);

  useEffect(() => {
    const root = document.body;

    const enhance = (target: ParentNode | HTMLElement) => {
      if (target instanceof HTMLElement && isSelectableCard(target)) ensureControls(target);
      target.querySelectorAll?.(".emoji-card[data-emoji-card]").forEach((node) => {
        if (isSelectableCard(node)) ensureControls(node);
      });
    };

    enhance(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) enhance(node);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.matches("[data-emoji-select]")) return;
      const card = target.closest(".emoji-card[data-emoji-card]");
      if (!(card instanceof HTMLElement) || !isSelectableCard(card)) return;
      const item = cardItem(card);
      if (!item) return;

      if (target.checked) selectedRef.current.set(item.key, item);
      else selectedRef.current.delete(item.key);
      syncCard(card);
      setCount(selectedRef.current.size);
    };

    document.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("change", onChange);
    };
  }, [cardItem, ensureControls, syncCard]);

  const clearSelection = () => {
    selectedRef.current.clear();
    document.querySelectorAll(".emoji-card[data-emoji-card]").forEach((node) => {
      if (isSelectableCard(node)) syncCard(node);
    });
    setCount(0);
  };

  const downloadSelected = async () => {
    const items = [...selectedRef.current.values()];
    if (!items.length || busy) return;

    const files: Array<{ name: string; data: Uint8Array }> = [];
    const failures: string[] = [];
    const used = new Set<string>();
    setBusy(true);

    const uniqueName = (filename: string) => {
      if (!used.has(filename)) {
        used.add(filename);
        return filename;
      }
      const dot = filename.lastIndexOf(".");
      const stem = dot > 0 ? filename.slice(0, dot) : filename;
      const extension = dot > 0 ? filename.slice(dot) : "";
      let index = 2;
      while (used.has(`${stem}-${index}${extension}`)) index += 1;
      const resolved = `${stem}-${index}${extension}`;
      used.add(resolved);
      return resolved;
    };

    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        setProgress(`Preparing ${index + 1}/${items.length}`);
        try {
          const response = await fetch(item.url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          files.push({ name: uniqueName(item.filename), data: new Uint8Array(await response.arrayBuffer()) });
        } catch {
          failures.push(item.name);
        }
      }

      if (!files.length) throw new Error("No selected files could be downloaded.");
      setProgress("Creating ZIP…");
      const objectUrl = URL.createObjectURL(buildZip(files));
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `eplus-emoji-${files.length}-items.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
      if (failures.length) window.alert(`Downloaded ${files.length} item(s). ${failures.length} item(s) could not be fetched.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not create the download.");
    } finally {
      setProgress("");
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          className="emoji-selection-bar"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 18, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 18, x: "-50%" }}
          transition={{ duration: 0.18 }}
        >
          <div className="emoji-selection-summary">
            <strong>{count}</strong>
            <span>selected</span>
          </div>
          <div className="emoji-selection-actions">
            <Button
              variant="ghost"
              size="sm"
              className="!border-0 !bg-transparent !text-background/80 !shadow-none hover:!bg-background/10 hover:!text-background disabled:!opacity-40"
              onClick={clearSelection}
              disabled={busy}
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="!border-background !bg-background !text-foreground !shadow-none hover:!bg-card disabled:!opacity-60"
              onClick={downloadSelected}
              disabled={busy}
            >
              <Download className="size-3.5" aria-hidden="true" />
              {busy ? progress || "Preparing…" : "Download ZIP"}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
