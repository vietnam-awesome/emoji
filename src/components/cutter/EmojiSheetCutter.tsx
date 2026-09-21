"use client";

import {
  ClipboardPaste,
  Copy,
  Crop,
  Download,
  Grid3X3,
  ImagePlus,
  Images,
  Pencil,
  Scissors,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../motion/button";
import { Input } from "../motion/input";

type Sheet = {
  id: string;
  name: string;
  url: string;
  origin: "local" | "library";
  source?: string;
};

type LibrarySheet = {
  id: string;
  name: string;
  image: string;
  thumbnail?: string;
  description?: string;
  source?: string;
  tags?: string[];
};

type LibraryManifest = {
  version?: number;
  sheets?: LibrarySheet[];
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SavedCrop = {
  id: string;
  name: string;
  sourceName: string;
  url: string;
  blob: Blob;
  width: number;
  height: number;
};

interface Props {
  editorUrl: string;
  libraryManifestUrl: string;
}

const EDITOR_HANDOFF_KEY = "eplus-emoji-editor-handoff";
const EDITOR_HANDOFF_NAME_KEY = "eplus-emoji-editor-handoff-name";

const createStarterSheet = (title: string, emoji: string[]) => {
  const width = 1024;
  const cell = 256;
  const labels = emoji.slice(0, 16).map((value, index) => {
    const x = (index % 4) * cell + cell / 2;
    const y = Math.floor(index / 4) * cell + cell / 2 + 12;
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="128" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${value}</text>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${width} ${width}"><rect width="100%" height="100%" rx="48" fill="#f8f8f8"/><g opacity=".08" stroke="#111"><path d="M256 0v1024M512 0v1024M768 0v1024M0 256h1024M0 512h1024M0 768h1024"/></g>${labels}<title>${title}</title></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const BUILT_IN_LIBRARY: LibrarySheet[] = [
  {
    id: "starter-faces",
    name: "Faces & reactions",
    image: createStarterSheet("Faces & reactions", ["😀","😂","🤣","😊","😎","😍","🥰","🤩","😭","😡","🥳","🤔","🫡","😴","🤯","👀"]),
    description: "A 4×4 practice sheet for testing manual emoji crops.",
    source: "Built-in demo",
    tags: ["faces", "reactions", "demo"],
  },
  {
    id: "starter-work-tech",
    name: "Work & tech",
    image: createStarterSheet("Work & tech", ["💻","⌨️","🖥️","📱","⚙️","🛠️","🚀","🔥","✅","❌","💡","📌","📦","🔧","🧪","🎯"]),
    description: "A 4×4 practice sheet with work and developer reactions.",
    source: "Built-in demo",
    tags: ["work", "tech", "demo"],
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeFilename = (value: string) =>
  String(value || "emoji")
    .trim()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80) || "emoji";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const canvasPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG."))),
      "image/png",
    );
  });

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
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
    const checksum = crc32(file.data);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
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
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, localOffset, true);

    localParts.push(localHeader, nameBytes, file.data);
    centralParts.push(centralHeader, nameBytes);
    localOffset += localHeader.length + nameBytes.length + file.data.length;
  }

  const centralBytes = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localOffset, true);

  return new Blob([concatBytes([...localParts, centralBytes, end])], {
    type: "application/zip",
  });
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the crop."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });

export default function EmojiSheetCutter({ editorUrl, libraryManifestUrl }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const objectUrlsRef = useRef(new Set<string>());
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  const [sourceMode, setSourceMode] = useState<"library" | "upload">("library");
  const [librarySheets, setLibrarySheets] = useState<LibrarySheet[]>(BUILT_IN_LIBRARY);
  const [libraryStatus, setLibraryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState("");
  const [selection, setSelection] = useState<CropRect | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [squareLock, setSquareLock] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [gridColumns, setGridColumns] = useState(4);
  const [gridRows, setGridRows] = useState(4);
  const [zoom, setZoom] = useState(100);
  const [outputSize, setOutputSize] = useState("original");
  const [cropName, setCropName] = useState("emoji-01");
  const [crops, setCrops] = useState<SavedCrop[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const activeSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0] || null,
    [sheets, activeSheetId],
  );

  useEffect(() => {
    let cancelled = false;

    const loadLibrary = async () => {
      setLibraryStatus("loading");
      try {
        const response = await fetch(libraryManifestUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Library manifest returned HTTP ${response.status}`);
        const manifest = await response.json() as LibraryManifest;
        const remoteSheets = Array.isArray(manifest?.sheets)
          ? manifest.sheets
              .filter((sheet) => sheet && sheet.id && sheet.name && sheet.image)
              .map((sheet) => {
                const resolveAsset = (value?: string) => {
                  if (!value) return undefined;
                  try {
                    return new URL(value, libraryManifestUrl).toString();
                  } catch {
                    return value;
                  }
                };
                return {
                  ...sheet,
                  image: resolveAsset(sheet.image) || sheet.image,
                  thumbnail: resolveAsset(sheet.thumbnail),
                };
              })
          : [];

        if (!cancelled) {
          const builtInIds = new Set(BUILT_IN_LIBRARY.map((sheet) => sheet.id));
          setLibrarySheets([
            ...BUILT_IN_LIBRARY,
            ...remoteSheets.filter((sheet) => !builtInIds.has(sheet.id)),
          ]);
          setLibraryStatus("ready");
        }
      } catch (reason) {
        if (!cancelled) {
          setLibrarySheets(BUILT_IN_LIBRARY);
          setLibraryStatus("error");
          console.warn("Could not load shared Cutter library", reason);
        }
      }
    };

    loadLibrary();
    return () => {
      cancelled = true;
    };
  }, [libraryManifestUrl]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
      objectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    setSelection(null);
    setDimensions({ width: 0, height: 0 });
    setZoom(100);
  }, [activeSheet?.id]);

  const makeObjectUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  };

  const addFiles = (files: FileList | File[]) => {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      setError("Choose one or more image files.");
      return;
    }

    const incoming: Sheet[] = images.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      name: file.name || `emoji-sheet-${sheets.length + index + 1}.png`,
      url: makeObjectUrl(file),
      origin: "local",
      source: "Your upload",
    }));

    setSourceMode("upload");
    setSheets((current) => [...current, ...incoming]);
    setActiveSheetId((current) => current || incoming[0].id);
    setError("");
    setStatus(`Added ${incoming.length} sheet${incoming.length === 1 ? "" : "s"}. Draw a box around one emoji to start.`);
  };

  const addLibrarySheet = (item: LibrarySheet) => {
    const id = `library:${item.id}`;
    setSheets((current) => {
      if (current.some((sheet) => sheet.id === id)) return current;
      return [
        ...current,
        {
          id,
          name: item.name,
          url: item.image,
          origin: "library",
          source: item.source || "Shared library",
        },
      ];
    });
    setActiveSheetId(id);
    setSelection(null);
    setError("");
    setStatus(`Opened ${item.name} from the shared library. Draw a box around an emoji to start cutting.`);
    window.requestAnimationFrame(() => {
      document.querySelector(".cutter-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const pasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        throw new Error("Clipboard image reading is not supported here. Use Ctrl/Cmd+V or Upload instead.");
      }

      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        files.push(new File([blob], `pasted-sheet-${files.length + 1}.${imageType.split("/")[1] || "png"}`, {
          type: imageType,
        }));
      }

      if (!files.length) throw new Error("No image was found in the clipboard.");
      addFiles(files);
    } catch (reason) {
      setStatus("");
      setError(reason instanceof Error ? reason.message : "Could not read an image from the clipboard.");
    }
  };

  const removeSheet = (id: string) => {
    const sheet = sheets.find((item) => item.id === id);
    if (sheet?.origin === "local") {
      URL.revokeObjectURL(sheet.url);
      objectUrlsRef.current.delete(sheet.url);
    }

    setSheets((current) => {
      const next = current.filter((item) => item.id !== id);
      if (activeSheetId === id) setActiveSheetId(next[0]?.id || "");
      return next;
    });
    setSelection(null);
  };

  const clearSheets = () => {
    for (const sheet of sheets) {
      if (sheet.origin !== "local") continue;
      URL.revokeObjectURL(sheet.url);
      objectUrlsRef.current.delete(sheet.url);
    }
    setSheets([]);
    setActiveSheetId("");
    setSelection(null);
    setDimensions({ width: 0, height: 0 });
    setStatus("");
  };

  const pointerPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height || !dimensions.width || !dimensions.height) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * dimensions.width, 0, dimensions.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * dimensions.height, 0, dimensions.height),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeSheet || !dimensions.width || !dimensions.height) return;
    const point = pointerPosition(event);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: point.x, startY: point.y };
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
    setStatus("");
    setError("");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointerPosition(event);
    if (!point) return;

    let endX = point.x;
    let endY = point.y;

    if (squareLock) {
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      const signX = dx < 0 ? -1 : 1;
      const signY = dy < 0 ? -1 : 1;
      const maxX = signX > 0 ? dimensions.width - drag.startX : drag.startX;
      const maxY = signY > 0 ? dimensions.height - drag.startY : drag.startY;
      const size = Math.min(Math.max(Math.abs(dx), Math.abs(dy)), maxX, maxY);
      endX = drag.startX + signX * size;
      endY = drag.startY + signY * size;
    }

    setSelection({
      x: Math.min(drag.startX, endX),
      y: Math.min(drag.startY, endY),
      width: Math.abs(endX - drag.startX),
      height: Math.abs(endY - drag.startY),
    });
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setSelection((current) => {
      if (!current || current.width < 4 || current.height < 4) return null;
      return current;
    });
  };

  const selectionStyle = selection && dimensions.width && dimensions.height
    ? {
        left: `${(selection.x / dimensions.width) * 100}%`,
        top: `${(selection.y / dimensions.height) * 100}%`,
        width: `${(selection.width / dimensions.width) * 100}%`,
        height: `${(selection.height / dimensions.height) * 100}%`,
      }
    : undefined;

  const createCropBlob = async () => {
    const image = imageRef.current;
    if (!image || !selection) throw new Error("Draw a crop box first.");

    const sourceX = Math.round(selection.x);
    const sourceY = Math.round(selection.y);
    const sourceWidth = Math.max(1, Math.round(selection.width));
    const sourceHeight = Math.max(1, Math.round(selection.height));
    const requested = outputSize === "original" ? 0 : Number(outputSize);

    const canvas = document.createElement("canvas");
    if (requested > 0) {
      canvas.width = requested;
      canvas.height = requested;
    } else {
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
    }

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (requested > 0) {
      const scale = Math.min(requested / sourceWidth, requested / sourceHeight);
      const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
      const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
      const drawX = Math.round((requested - drawWidth) / 2);
      const drawY = Math.round((requested - drawHeight) / 2);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    } else {
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
      );
    }

    return {
      blob: await canvasPngBlob(canvas),
      width: canvas.width,
      height: canvas.height,
    };
  };

  const saveCrop = async () => {
    if (!activeSheet || !selection) return;

    try {
      const result = await createCropBlob();
      const cleanName = sanitizeFilename(cropName || `emoji-${crops.length + 1}`);
      const crop: SavedCrop = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: cleanName,
        sourceName: activeSheet.name,
        url: makeObjectUrl(result.blob),
        blob: result.blob,
        width: result.width,
        height: result.height,
      };

      setCrops((current) => [...current, crop]);
      setCropName(`emoji-${String(crops.length + 2).padStart(2, "0")}`);
      setSelection(null);
      setError("");
      setStatus(`Saved ${cleanName}. Draw another crop box for the next emoji.`);
    } catch (reason) {
      setStatus("");
      setError(reason instanceof Error ? reason.message : "Could not create the crop.");
    }
  };

  const downloadCrop = (crop: SavedCrop) => {
    const link = document.createElement("a");
    link.href = crop.url;
    link.download = `${sanitizeFilename(crop.name)}.png`;
    document.body.append(link);
    link.click();
    link.remove();
  };

  const copyCrop = async (crop: SavedCrop) => {
    try {
      if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
        throw new Error("Image copy is not supported in this browser.");
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": crop.blob })]);
      setError("");
      setStatus(`Copied ${crop.name} as PNG.`);
    } catch (reason) {
      setStatus("");
      setError(reason instanceof Error ? reason.message : "Could not copy the crop.");
    }
  };

  const editCrop = async (crop: SavedCrop) => {
    try {
      const dataUrl = await blobToDataUrl(crop.blob);
      sessionStorage.setItem(EDITOR_HANDOFF_KEY, dataUrl);
      sessionStorage.setItem(EDITOR_HANDOFF_NAME_KEY, `${sanitizeFilename(crop.name)}.png`);
      window.location.href = `${editorUrl}?handoff=cutter`;
    } catch (reason) {
      setStatus("");
      setError(reason instanceof Error ? reason.message : "Could not open this crop in the editor.");
    }
  };

  const removeCrop = (id: string) => {
    setCrops((current) => {
      const target = current.find((crop) => crop.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        objectUrlsRef.current.delete(target.url);
      }
      return current.filter((crop) => crop.id !== id);
    });
  };

  const downloadAll = async () => {
    if (!crops.length) return;
    try {
      const files = await Promise.all(
        crops.map(async (crop) => ({
          name: `${sanitizeFilename(crop.name)}.png`,
          data: new Uint8Array(await crop.blob.arrayBuffer()),
        })),
      );
      const zipUrl = URL.createObjectURL(buildZip(files));
      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = `eplus-emoji-crops-${files.length}.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(zipUrl), 1500);
      setStatus(`Downloaded ${files.length} crops as ZIP.`);
      setError("");
    } catch {
      setStatus("");
      setError("Could not create the ZIP.");
    }
  };

  const clearCrops = () => {
    for (const crop of crops) {
      URL.revokeObjectURL(crop.url);
      objectUrlsRef.current.delete(crop.url);
    }
    setCrops([]);
    setCropName("emoji-01");
  };

  const gridStyle = showGrid
    ? {
        backgroundImage: `linear-gradient(to right, transparent calc(100% - 1px), rgba(255,255,255,.55) 0), linear-gradient(to bottom, transparent calc(100% - 1px), rgba(255,255,255,.55) 0)`,
        backgroundSize: `${100 / gridColumns}% 100%, 100% ${100 / gridRows}%`,
      }
    : undefined;

  return (
    <div className="cutter-page">
      <header className="cutter-hero">
        <div>
          <p className="eyebrow">Browser tool</p>
          <h1>Emoji Sheet Cutter</h1>
          <p>
            Choose a shared sheet from the Library, or upload/paste your own image. Draw a crop box around each emoji,
            then save clean PNGs one by one. Your own uploads stay in the browser.
          </p>
        </div>
        <div className="cutter-hero-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files?.length) addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <Button variant="primary" size="md" ripple onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Upload sheets
          </Button>
          <Button variant="secondary" size="md" ripple onClick={pasteFromClipboard}>
            <ClipboardPaste className="size-4" aria-hidden="true" />
            Paste image
          </Button>
        </div>
        <div className="cutter-hero-meta" aria-label="Emoji Sheet Cutter capabilities">
          <span>Multi-image</span>
          <span>Manual crop</span>
          <span>Square lock</span>
          <span>PNG + ZIP</span>
          <span>100% local</span>
        </div>
      </header>

      <section className="cutter-source-panel" aria-labelledby="cutter-source-title">
        <div className="cutter-source-heading">
          <div>
            <p className="section-kicker">Source</p>
            <h2 id="cutter-source-title">Choose a sheet</h2>
            <p>Start from the shared library or bring your own image.</p>
          </div>
          <div className="cutter-source-tabs" role="tablist" aria-label="Sheet source">
            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === "library"}
              className={sourceMode === "library" ? "is-active" : ""}
              onClick={() => setSourceMode("library")}
            >
              <Images aria-hidden="true" />
              Library
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === "upload"}
              className={sourceMode === "upload" ? "is-active" : ""}
              onClick={() => setSourceMode("upload")}
            >
              <Upload aria-hidden="true" />
              Upload / Paste
            </button>
          </div>
        </div>

        {sourceMode === "library" ? (
          <div className="cutter-library-panel" role="tabpanel">
            <div className="cutter-library-meta">
              <span>
                {libraryStatus === "loading"
                  ? "Loading shared library…"
                  : libraryStatus === "error"
                    ? "Shared library unavailable — built-in sheets are still ready."
                    : `${librarySheets.length} sheet${librarySheets.length === 1 ? "" : "s"} available`}
              </span>
              <small>Shared assets are read from the repository data branch.</small>
            </div>
            <div className="cutter-library-grid">
              {librarySheets.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="cutter-library-card"
                  onClick={() => addLibrarySheet(item)}
                >
                  <span className="cutter-library-preview">
                    <img src={item.thumbnail || item.image} alt="" loading="lazy" />
                  </span>
                  <span className="cutter-library-copy">
                    <strong>{item.name}</strong>
                    <span>{item.description || "Shared emoji sheet ready to cut."}</span>
                    <small>{item.source || "Shared library"}</small>
                  </span>
                  <span className="cutter-library-use">Use sheet</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={`cutter-dropzone${dragOver ? " is-dragover" : ""}${sheets.length ? " is-compact" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
            }}
          >
            <span className="cutter-dropzone-icon" aria-hidden="true"><ImagePlus /></span>
            <strong>Drop emoji sheets here</strong>
            <span>PNG, JPG, WebP or other browser-readable image files</span>
            <small>You can also copy an image from ChatGPT and press Ctrl/Cmd+V.</small>
          </button>
        )}
      </section>

      {sheets.length > 0 ? (
        <>
          <div className="cutter-sheet-strip" aria-label="Working sheets">
            <div className="cutter-sheet-list">
              {sheets.map((sheet, index) => (
                <div className="cutter-sheet-item" key={sheet.id}>
                  <button
                    type="button"
                    className={`cutter-sheet-chip${activeSheet?.id === sheet.id ? " is-active" : ""}`}
                    onClick={() => setActiveSheetId(sheet.id)}
                    aria-pressed={activeSheet?.id === sheet.id}
                  >
                    <img src={sheet.url} alt="" />
                    <span>
                      <strong>Sheet {index + 1}</strong>
                      <small>{sheet.source || sheet.name}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="cutter-sheet-remove"
                    aria-label={`Remove ${sheet.name}`}
                    data-beui-tooltip="Remove sheet"
                    onClick={() => removeSheet(sheet.id)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button variant="secondary" size="sm" ripple onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden="true" />
                Add sheet
              </Button>
            </div>
            <button type="button" className="cutter-text-action" onClick={clearSheets}>Clear sheets</button>
          </div>

          <div className="cutter-workspace">
            <section className="cutter-stage-column" aria-label="Crop workspace">
              <div className="cutter-stage-toolbar">
                <div>
                  <strong>{activeSheet?.name}</strong>
                  <span>
                    {dimensions.width > 0 ? `${dimensions.width}×${dimensions.height}px` : "Loading image…"}
                  </span>
                </div>
                <div className="cutter-stage-toolbar-actions">
                  <label className="cutter-toggle">
                    <input type="checkbox" checked={squareLock} onChange={(event) => setSquareLock(event.target.checked)} />
                    <span>Square lock</span>
                  </label>
                  <label className="cutter-toggle">
                    <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
                    <Grid3X3 aria-hidden="true" />
                    <span>Grid</span>
                  </label>
                </div>
              </div>

              <div
                className="cutter-stage"
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
                }}
              >
                <div
                  className="cutter-image-wrap"
                  style={{ width: `${zoom}%`, touchAction: "none" }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={finishPointer}
                  onPointerCancel={finishPointer}
                >
                  {activeSheet && (
                    <img
                      ref={imageRef}
                      src={activeSheet.url}
                      crossOrigin={activeSheet.origin === "library" && !activeSheet.url.startsWith("data:") ? "anonymous" : undefined}
                      alt={`Crop source ${activeSheet.name}`}
                      draggable={false}
                      onError={() => {
                        setStatus("");
                        setError("This shared sheet could not be loaded for cropping. Try another library sheet or upload the image directly.");
                      }}
                      onLoad={(event) => {
                        setDimensions({
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        });
                      }}
                    />
                  )}
                  {showGrid ? <span className="cutter-grid-guide" style={gridStyle} aria-hidden="true" /> : null}
                  {selection && selectionStyle ? (
                    <span className="cutter-selection" style={selectionStyle} aria-hidden="true">
                      <span className="cutter-selection-label">
                        {Math.round(selection.width)} × {Math.round(selection.height)}
                      </span>
                      <i className="cutter-handle cutter-handle--nw"></i>
                      <i className="cutter-handle cutter-handle--ne"></i>
                      <i className="cutter-handle cutter-handle--sw"></i>
                      <i className="cutter-handle cutter-handle--se"></i>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="cutter-stage-footer">
                <label className="cutter-zoom">
                  <span>Zoom</span>
                  <input
                    type="range"
                    min="60"
                    max="220"
                    step="10"
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                  <strong>{zoom}%</strong>
                </label>
                <p>Drag directly on the image to create or replace the crop box.</p>
              </div>
            </section>

            <aside className="cutter-controls">
              <section className="cutter-control-card">
                <div className="cutter-control-heading">
                  <span className="cutter-step">1</span>
                  <div>
                    <h2>Select one emoji</h2>
                    <p>Draw around the emoji. Keep Square lock on for standard emoji exports.</p>
                  </div>
                </div>

                {showGrid ? (
                  <div className="cutter-grid-controls">
                    <label>
                      <span>Columns</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={gridColumns}
                        onChange={(event) => setGridColumns(clamp(Number(event.target.value) || 1, 1, 12))}
                      />
                    </label>
                    <label>
                      <span>Rows</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={gridRows}
                        onChange={(event) => setGridRows(clamp(Number(event.target.value) || 1, 1, 12))}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="cutter-selection-info">
                  <span>Crop</span>
                  <strong>
                    {selection
                      ? `${Math.round(selection.width)} × ${Math.round(selection.height)}px`
                      : "No selection"}
                  </strong>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!selection}
                  onClick={() => setSelection(null)}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Clear selection
                </Button>
              </section>

              <section className="cutter-control-card">
                <div className="cutter-control-heading">
                  <span className="cutter-step">2</span>
                  <div>
                    <h2>Save the crop</h2>
                    <p>Name it and choose an optional square export size.</p>
                  </div>
                </div>

                <label className="cutter-field">
                  <span>Filename</span>
                  <Input
                    value={cropName}
                    onChange={setCropName}
                    aria-label="Crop filename"
                    placeholder="emoji-01"
                  />
                </label>

                <label className="cutter-field">
                  <span>Output</span>
                  <select value={outputSize} onChange={(event) => setOutputSize(event.target.value)}>
                    <option value="original">Original crop size</option>
                    <option value="512">512 × 512 PNG</option>
                    <option value="256">256 × 256 PNG</option>
                    <option value="128">128 × 128 PNG</option>
                    <option value="64">64 × 64 PNG</option>
                  </select>
                </label>

                <Button variant="primary" size="md" ripple disabled={!selection} onClick={saveCrop}>
                  <Crop className="size-4" aria-hidden="true" />
                  Save crop
                </Button>
              </section>

              <section className="cutter-control-card cutter-help-card">
                <Scissors aria-hidden="true" />
                <div>
                  <strong>Fast workflow</strong>
                  <p>Draw → Save crop → draw the next emoji. Saved crops stay below while you move through all sheets.</p>
                </div>
              </section>
            </aside>
          </div>
        </>
      ) : null}

      {status ? <p className="cutter-status" role="status">{status}</p> : null}
      {error ? <p className="cutter-error" role="alert">{error}</p> : null}

      {crops.length > 0 ? (
        <section className="cutter-results" aria-labelledby="cutter-results-title">
          <div className="cutter-results-heading">
            <div>
              <p className="section-kicker">Your cuts</p>
              <h2 id="cutter-results-title">{crops.length} emoji crop{crops.length === 1 ? "" : "s"}</h2>
              <p>Download each image, copy it, continue editing, or export the whole batch as ZIP.</p>
            </div>
            <div className="cutter-results-actions">
              <Button variant="secondary" size="sm" onClick={clearCrops}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Clear
              </Button>
              <Button variant="primary" size="sm" ripple onClick={downloadAll}>
                <Download className="size-3.5" aria-hidden="true" />
                Download ZIP
              </Button>
            </div>
          </div>

          <div className="cutter-results-grid">
            {crops.map((crop) => (
              <article className="cutter-result-card" key={crop.id}>
                <div className="cutter-result-preview">
                  <img src={crop.url} alt={crop.name} />
                </div>
                <div className="cutter-result-body">
                  <strong>{crop.name}</strong>
                  <span>{crop.width}×{crop.height}px · {formatBytes(crop.blob.size)}</span>
                  <small>{crop.sourceName}</small>
                  <div className="cutter-result-actions">
                    <Button
                      variant="secondary"
                      size="icon"
                      data-beui-tooltip="Download PNG"
                      aria-label={`Download ${crop.name}`}
                      onClick={() => downloadCrop(crop)}
                    >
                      <Download className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      data-beui-tooltip="Copy PNG"
                      aria-label={`Copy ${crop.name}`}
                      onClick={() => copyCrop(crop)}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      data-beui-tooltip="Edit in Emoji Editor"
                      aria-label={`Edit ${crop.name}`}
                      onClick={() => editCrop(crop)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-beui-tooltip="Remove crop"
                      aria-label={`Remove ${crop.name}`}
                      onClick={() => removeCrop(crop.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
