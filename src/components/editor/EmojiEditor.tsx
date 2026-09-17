import {
  Clipboard,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Move,
  Redo2,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Undo2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../motion/select';
import GifFrameTimeline, { type GifTimelineFrame } from './GifFrameTimeline';

type FitMode = 'contain' | 'cover';
type ExportFormat = 'png' | 'webp' | 'gif';

type Settings = {
  size: number;
  padding: number;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  fitMode: FitMode;
  background: string;
};

type SourceInfo = {
  name: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
  animated: boolean;
};

type DecodedCanvasFrame = {
  canvas: HTMLCanvasElement;
  delay: number;
};

type DecodedGifFrame = {
  dims: { left: number; top: number; width: number; height: number };
  patch: Uint8ClampedArray;
  delay: number;
  disposalType: number;
};

type HistorySnapshot = {
  settings: Settings;
  frames: GifTimelineFrame[];
  currentFrameId: string | null;
  gifSpeed: number;
};

interface Props {
  browseUrl: string;
}

const PRESETS = [32, 64, 128, 256, 512];
const GIF_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MAX_GIF_DECODE_PIXELS = 18_000_000;
const DEFAULTS: Settings = {
  size: 128,
  padding: 8,
  zoom: 100,
  panX: 0,
  panY: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
  fitMode: 'contain',
  background: 'transparent',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const equal = (a: Settings, b: Settings) => JSON.stringify(a) === JSON.stringify(b);
const cloneFrames = (frames: GifTimelineFrame[]) => frames.map((frame) => ({ ...frame }));
const formatBytes = (bytes: number) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const formatDuration = (milliseconds: number) => {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
};
const fileStem = (name: string) => String(name || 'emoji')
  .replace(/\.[a-z0-9]+$/i, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'emoji';
const createFrameId = (index: number) =>
  globalThis.crypto?.randomUUID?.() ?? `frame-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;

async function decodeGif(blob: Blob, width: number, height: number): Promise<DecodedCanvasFrame[]> {
  const { parseGIF, decompressFrames } = await import('gifuct-js');
  const parsed = parseGIF(await blob.arrayBuffer());
  const decoded = decompressFrames(parsed, true) as DecodedGifFrame[];
  if (decoded.length <= 1) return [];
  if (width * height * decoded.length > MAX_GIF_DECODE_PIXELS) {
    throw new Error(`This GIF has ${decoded.length} frames and is too large to edit safely in the browser.`);
  }

  const composite = document.createElement('canvas');
  composite.width = width;
  composite.height = height;
  const context = composite.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable in this browser.');
  context.clearRect(0, 0, width, height);

  const frames: DecodedCanvasFrame[] = [];
  for (const frame of decoded) {
    const restore = frame.disposalType === 3 ? context.getImageData(0, 0, width, height) : null;
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    const patchContext = patchCanvas.getContext('2d');
    if (!patchContext) throw new Error('Canvas is unavailable in this browser.');
    patchContext.putImageData(
      new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height),
      0,
      0,
    );
    context.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

    const rendered = document.createElement('canvas');
    rendered.width = width;
    rendered.height = height;
    const renderedContext = rendered.getContext('2d');
    if (!renderedContext) throw new Error('Canvas is unavailable in this browser.');
    renderedContext.drawImage(composite, 0, 0);
    frames.push({ canvas: rendered, delay: Math.max(20, frame.delay || 100) });

    if (frame.disposalType === 2) {
      context.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    } else if (frame.disposalType === 3 && restore) {
      context.putImageData(restore, 0, 0);
    }
  }
  return frames;
}

export default function EmojiEditor({ browseUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const settingsRef = useRef<Settings>(DEFAULTS);
  const gifFramesRef = useRef<GifTimelineFrame[]>([]);
  const initialGifFramesRef = useRef<GifTimelineFrame[]>([]);
  const currentFrameIdRef = useRef<string | null>(null);
  const gifSpeedRef = useRef(1);
  const gestureRef = useRef<HistorySnapshot | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; settings: Settings } | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [gifFrames, setGifFrames] = useState<GifTimelineFrame[]>([]);
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [gifSpeed, setGifSpeed] = useState(1);

  const replace = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const replaceFrames = useCallback((next: GifTimelineFrame[]) => {
    gifFramesRef.current = next;
    setGifFrames(next);
  }, []);

  const replaceCurrentFrameId = useCallback((next: string | null) => {
    currentFrameIdRef.current = next;
    setCurrentFrameId(next);
  }, []);

  const replaceGifSpeed = useCallback((next: number) => {
    gifSpeedRef.current = next;
    setGifSpeed(next);
  }, []);

  const snapshot = useCallback((): HistorySnapshot => ({
    settings: { ...settingsRef.current },
    frames: cloneFrames(gifFramesRef.current),
    currentFrameId: currentFrameIdRef.current,
    gifSpeed: gifSpeedRef.current,
  }), []);

  const pushHistory = useCallback(() => {
    const current = snapshot();
    setPast((items) => [...items, current].slice(-60));
    setFuture([]);
  }, [snapshot]);

  const applySnapshot = useCallback((next: HistorySnapshot) => {
    replace({ ...next.settings });
    replaceFrames(cloneFrames(next.frames));
    replaceCurrentFrameId(next.currentFrameId);
    replaceGifSpeed(next.gifSpeed);
  }, [replace, replaceFrames, replaceCurrentFrameId, replaceGifSpeed]);

  const commit = useCallback((patch: Partial<Settings>) => {
    const current = settingsRef.current;
    const next = { ...current, ...patch };
    if (equal(current, next)) return;
    pushHistory();
    replace(next);
  }, [pushHistory, replace]);

  const transient = useCallback((patch: Partial<Settings>) => {
    replace({ ...settingsRef.current, ...patch });
  }, [replace]);

  const beginGesture = () => {
    if (!gestureRef.current) gestureRef.current = snapshot();
  };
  const endGesture = () => {
    const start = gestureRef.current;
    gestureRef.current = null;
    if (!start || equal(start.settings, settingsRef.current)) return;
    setPast((items) => [...items, start].slice(-60));
    setFuture([]);
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    const current = snapshot();
    setPast(past.slice(0, -1));
    setFuture([current, ...future].slice(0, 60));
    applySnapshot(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    const current = snapshot();
    setFuture(future.slice(1));
    setPast([...past, current].slice(-60));
    applySnapshot(next);
  };

  const reset = () => {
    if (!source) return;
    pushHistory();
    replace(DEFAULTS);
    const restoredFrames = cloneFrames(initialGifFramesRef.current).map((frame) => ({ ...frame, enabled: true }));
    replaceFrames(restoredFrames);
    replaceCurrentFrameId(restoredFrames[0]?.id ?? null);
    replaceGifSpeed(1);
    setPlaying(Boolean(source.animated));
    setFormat(source.animated ? 'gif' : 'png');
  };

  const loadBlob = useCallback(async (blob: Blob, name: string, animatedHint: boolean) => {
    setError('');
    setStatus('');
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(blob);
    objectUrlRef.current = objectUrl;

    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The selected image could not be decoded.'));
      image.src = objectUrl;
    });

    const isGif = blob.type === 'image/gif' || /\.gif$/i.test(name);
    const decoded = isGif ? await decodeGif(blob, image.naturalWidth, image.naturalHeight) : [];
    const frames: GifTimelineFrame[] = decoded.map((frame, index) => ({
      id: createFrameId(index),
      canvas: frame.canvas,
      delay: frame.delay,
      enabled: true,
      originalIndex: index,
    }));

    imageRef.current = image;
    initialGifFramesRef.current = cloneFrames(frames);
    replaceFrames(frames);
    const animated = frames.length > 1;
    setSource({
      name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      bytes: blob.size,
      mime: blob.type || 'image/*',
      animated,
    });
    replaceCurrentFrameId(frames[0]?.id ?? null);
    replaceGifSpeed(1);
    setPlaying(animated);
    setFormat(animated ? 'gif' : 'png');
    if (animatedHint && !animated && !isGif) {
      setStatus('This animated format is currently loaded as a static frame. GIF editing is fully supported.');
    }
    replace(DEFAULTS);
    setPast([]);
    setFuture([]);
  }, [replace, replaceFrames, replaceCurrentFrameId, replaceGifSpeed]);

  const loadRemote = useCallback(async (url: string, name: string, animated: boolean) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`Image request returned HTTP ${response.status}.`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('The source URL did not return an image.');
      await loadBlob(blob, name || 'emoji', animated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load this emoji for editing.');
    } finally {
      setLoading(false);
    }
  }, [loadBlob]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    if (src) void loadRemote(src, params.get('name') || 'emoji', params.get('animated') === '1');
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [loadRemote]);

  useEffect(() => {
    if (!source?.animated || !playing) return;
    const activeFrames = gifFramesRef.current.filter((frame) => frame.enabled);
    if (!activeFrames.length) return;
    let activeIndex = activeFrames.findIndex((frame) => frame.id === currentFrameIdRef.current);
    if (activeIndex < 0) {
      replaceCurrentFrameId(activeFrames[0].id);
      activeIndex = 0;
    }
    const frame = activeFrames[activeIndex];
    const delay = Math.max(20, Math.round(frame.delay / gifSpeedRef.current));
    const timer = window.setTimeout(() => {
      const next = activeFrames[(activeIndex + 1) % activeFrames.length];
      replaceCurrentFrameId(next.id);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [currentFrameId, gifFrames, gifSpeed, playing, replaceCurrentFrameId, source?.animated]);

  const draw = useCallback((canvas: HTMLCanvasElement, size: number, drawableOverride?: CanvasImageSource) => {
    const context = canvas.getContext('2d');
    const current = settingsRef.current;
    const currentFrame = gifFramesRef.current.find((frame) => frame.id === currentFrameIdRef.current);
    const drawable = drawableOverride ?? currentFrame?.canvas ?? imageRef.current ?? undefined;
    if (!context) return;

    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (current.background !== 'transparent') {
      context.fillStyle = current.background;
      context.fillRect(0, 0, size, size);
    }
    if (!drawable || !source) return;

    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const pad = size * clamp(current.padding, 0, 45) / 100;
    const available = Math.max(1, size - pad * 2);
    const quarterTurn = Math.abs(current.rotation % 180) === 90;
    const rotatedWidth = quarterTurn ? sourceHeight : sourceWidth;
    const rotatedHeight = quarterTurn ? sourceWidth : sourceHeight;
    const baseScale = current.fitMode === 'cover'
      ? Math.max(available / rotatedWidth, available / rotatedHeight)
      : Math.min(available / rotatedWidth, available / rotatedHeight);
    const scale = baseScale * clamp(current.zoom, 25, 300) / 100;

    context.save();
    context.beginPath();
    context.rect(pad, pad, available, available);
    context.clip();
    context.translate(
      size / 2 + size * clamp(current.panX, -100, 100) / 100,
      size / 2 + size * clamp(current.panY, -100, 100) / 100,
    );
    context.rotate(current.rotation * Math.PI / 180);
    context.scale(current.flipX ? -scale : scale, current.flipY ? -scale : scale);
    context.drawImage(drawable, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
    context.restore();
  }, [source]);

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, settings.size);
  }, [draw, settings, source, currentFrameId, gifFrames]);

  const makeGifBlob = useCallback(async () => {
    const frames = gifFramesRef.current.filter((frame) => frame.enabled);
    if (!source?.animated || !frames.length) throw new Error('Load an animated GIF with at least one included frame before exporting GIF.');
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    const gif = GIFEncoder();
    const canvas = document.createElement('canvas');
    const size = settingsRef.current.size;
    const transparentBackground = settingsRef.current.background === 'transparent';
    const paletteFormat = transparentBackground ? 'rgba4444' : 'rgb565';

    for (let index = 0; index < frames.length; index += 1) {
      draw(canvas, size, frames[index].canvas);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas is unavailable in this browser.');
      const pixels = context.getImageData(0, 0, size, size).data;
      const palette = quantize(pixels, 256, transparentBackground
        ? { format: 'rgba4444', oneBitAlpha: true }
        : { format: 'rgb565' });
      const indexed = applyPalette(pixels, palette, paletteFormat);
      const transparentIndex = transparentBackground
        ? palette.findIndex((color: number[]) => color.length > 3 && color[3] === 0)
        : -1;
      gif.writeFrame(indexed, size, size, {
        palette,
        delay: Math.max(20, Math.round(frames[index].delay / gifSpeedRef.current)),
        repeat: 0,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
        dispose: transparentIndex >= 0 ? 2 : 1,
      });
      if (index % 6 === 0 || index === frames.length - 1) {
        setStatus(`Encoding GIF · ${index + 1}/${frames.length} included frames`);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  }, [draw, source?.animated]);

  const makeBlob = useCallback(async (target: ExportFormat) => {
    if (!imageRef.current) throw new Error('Choose an emoji or upload an image first.');
    if (target === 'gif') return makeGifBlob();
    const canvas = document.createElement('canvas');
    draw(canvas, settingsRef.current.size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode this image.')),
        target === 'webp' ? 'image/webp' : 'image/png',
        target === 'webp' ? 0.92 : undefined,
      );
    });
  }, [draw, makeGifBlob]);

  const download = async () => {
    try {
      setError('');
      setStatus(format === 'gif' ? 'Preparing animated GIF…' : 'Preparing export…');
      const blob = await makeBlob(format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileStem(source?.name || 'emoji')}-${settingsRef.current.size}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      setStatus(`Exported ${format.toUpperCase()} · ${formatBytes(blob.size)}`);
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Export failed.');
    }
  };

  const copyPng = async () => {
    try {
      if (!('ClipboardItem' in window) || !navigator.clipboard?.write) {
        throw new Error('Image copy is not supported by this browser. Use Download instead.');
      }
      setError('');
      setStatus('Copying current frame…');
      const blob = await makeBlob('png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus(`Copied PNG · ${formatBytes(blob.size)}`);
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Unable to copy this image.');
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setLoading(true);
    try {
      await loadBlob(file, file.name, file.type === 'image/gif');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load this image.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFrame = (frameId: string, enabled: boolean) => {
    const frames = gifFramesRef.current;
    const target = frames.find((frame) => frame.id === frameId);
    if (!target || target.enabled === enabled) return;
    if (!enabled && frames.filter((frame) => frame.enabled).length <= 1) {
      setError('A GIF needs at least one included frame.');
      return;
    }
    pushHistory();
    const next = frames.map((frame) => frame.id === frameId ? { ...frame, enabled } : frame);
    replaceFrames(next);
    if (!enabled && currentFrameIdRef.current === frameId) {
      const nextActive = next.find((frame) => frame.enabled);
      replaceCurrentFrameId(nextActive?.id ?? frameId);
    }
  };

  const duplicateFrame = (frameId: string) => {
    const frames = gifFramesRef.current;
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) return;
    pushHistory();
    const sourceFrame = frames[index];
    const duplicate: GifTimelineFrame = {
      ...sourceFrame,
      id: createFrameId(-1),
      originalIndex: -1,
      enabled: true,
    };
    const next = [...frames.slice(0, index + 1), duplicate, ...frames.slice(index + 1)];
    replaceFrames(next);
    replaceCurrentFrameId(duplicate.id);
    setPlaying(false);
  };

  const deleteFrame = (frameId: string) => {
    const frames = gifFramesRef.current;
    if (frames.length <= 1) {
      setError('A GIF needs at least one frame.');
      return;
    }
    const index = frames.findIndex((frame) => frame.id === frameId);
    if (index < 0) return;
    pushHistory();
    let next = frames.filter((frame) => frame.id !== frameId);
    if (!next.some((frame) => frame.enabled)) {
      next = next.map((frame, nextIndex) => nextIndex === Math.min(index, next.length - 1) ? { ...frame, enabled: true } : frame);
    }
    replaceFrames(next);
    if (currentFrameIdRef.current === frameId) {
      const replacement = next[Math.min(index, next.length - 1)] ?? next[0];
      replaceCurrentFrameId(replacement?.id ?? null);
    }
    setPlaying(false);
  };

  const changeFrameDelay = (frameId: string, delay: number) => {
    const clean = clamp(Math.round(delay), 20, 5000);
    const frames = gifFramesRef.current;
    const target = frames.find((frame) => frame.id === frameId);
    if (!target || target.delay === clean) return;
    pushHistory();
    replaceFrames(frames.map((frame) => frame.id === frameId ? { ...frame, delay: clean } : frame));
  };

  const enableAllFrames = () => {
    const frames = gifFramesRef.current;
    if (!frames.some((frame) => !frame.enabled)) return;
    pushHistory();
    replaceFrames(frames.map((frame) => ({ ...frame, enabled: true })));
  };

  const changeGifSpeed = (next: number) => {
    if (gifSpeedRef.current === next) return;
    pushHistory();
    replaceGifSpeed(next);
  };

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!source) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, settings: settingsRef.current };
    setDragging(true);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    transient({
      panX: clamp(drag.settings.panX + ((event.clientX - drag.x) / rect.width) * 100, -100, 100),
      panY: clamp(drag.settings.panY + ((event.clientY - drag.y) / rect.height) * 100, -100, 100),
    });
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (!equal(drag.settings, settingsRef.current)) {
      setPast((items) => [...items, {
        ...snapshot(),
        settings: { ...drag.settings },
      }].slice(-60));
      setFuture([]);
    }
  };

  const customBackground = settings.background.startsWith('#') ? settings.background : '#ffffff';
  const sliderProps = {
    onFocus: beginGesture,
    onBlur: endGesture,
    onPointerDown: beginGesture,
    onPointerUp: endGesture,
  };
  const activeFrames = gifFrames.filter((frame) => frame.enabled);
  const currentFrame = gifFrames.find((frame) => frame.id === currentFrameId) ?? gifFrames[0];
  const currentFrameIndex = Math.max(0, gifFrames.findIndex((frame) => frame.id === currentFrame?.id));
  const gifDuration = activeFrames.reduce((total, frame) => total + frame.delay, 0) / gifSpeed;

  return (
    <div className="emoji-editor">
      <div className="editor-topbar">
        <div>
          <p className="eyebrow">Browser-based image tool</p>
          <h1>Emoji editor</h1>
          <p>Crop, resize, edit GIF frames and export emoji locally in your browser.</p>
        </div>
        <div className="editor-history-actions">
          <button type="button" onClick={undo} disabled={!past.length}><Undo2 /><span>Undo</span></button>
          <button type="button" onClick={redo} disabled={!future.length}><Redo2 /><span>Redo</span></button>
          <button type="button" onClick={reset} disabled={!source}><RefreshCcw /><span>Reset</span></button>
        </div>
      </div>

      {source?.animated && (
        <div className="editor-notice">
          GIF frame editing is active. Uncheck frames to exclude them, duplicate or delete a frame, or change its delay before exporting.
        </div>
      )}
      {error && <div className="editor-message" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      <div className="editor-workspace">
        <section className="editor-canvas-column">
          <div className="editor-canvas-toolbar">
            <div>
              <strong>{source?.name || 'No image selected'}</strong>
              <span>{source ? `${source.width}×${source.height}px · ${formatBytes(source.bytes)}${source.animated ? ` · ${activeFrames.length}/${gifFrames.length} frames included` : ''}` : 'Choose an emoji or upload an image.'}</span>
            </div>
            <label className="editor-upload-button"><Upload /><span>{source ? 'Replace' : 'Upload image'}</span><input type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0])} /></label>
          </div>

          <div className="editor-stage">
            {loading && <div className="editor-stage-loading">Loading image…</div>}
            {!source && !loading && (
              <label className="editor-empty-state">
                <ImagePlus />
                <strong>Choose an image to start</strong>
                <span>PNG, WebP, JPG, GIF or SVG</span>
                <b>Upload image</b>
                <input type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0])} />
              </label>
            )}
            {source && (
              <div className="editor-checkerboard">
                <canvas
                  ref={canvasRef}
                  className={dragging ? 'is-dragging' : ''}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerEnd}
                  onPointerCancel={pointerEnd}
                  aria-label="Emoji preview. Drag to reposition."
                />
              </div>
            )}
            {source && <div className="editor-drag-hint"><Move /> Drag to reposition</div>}
          </div>
          <div className="editor-canvas-meta">
            <span>Output <strong>{settings.size}×{settings.size}px</strong></span>
            <span>Zoom <strong>{Math.round(settings.zoom)}%</strong></span>
            {source?.animated && <span>Frame <strong>{currentFrameIndex + 1}/{gifFrames.length}</strong></span>}
          </div>

          {source?.animated && (
            <GifFrameTimeline
              frames={gifFrames}
              currentFrameId={currentFrame?.id ?? null}
              playing={playing}
              onPlayingChange={setPlaying}
              onCurrentFrameChange={replaceCurrentFrameId}
              onToggleFrame={toggleFrame}
              onDuplicateFrame={duplicateFrame}
              onDeleteFrame={deleteFrame}
              onDelayChange={changeFrameDelay}
              onEnableAll={enableAllFrames}
            />
          )}
        </section>

        <aside className="editor-controls">
          {source?.animated && (
            <section className="editor-control-group editor-animation-group">
              <div className="editor-control-heading"><strong>Animation</strong><small>{activeFrames.length}/{gifFrames.length} frames · {formatDuration(gifDuration)}</small></div>
              <div className="editor-animation-speed editor-animation-speed-full">
                <span>Playback speed</span>
                <Select value={String(gifSpeed)} onValueChange={(value) => changeGifSpeed(Number(value))} className="editor-beui-select">
                  <SelectTrigger className="editor-beui-select-trigger"><SelectValue /></SelectTrigger>
                  <SelectContent className="editor-beui-select-content">
                    {GIF_SPEEDS.map((speed) => <SelectItem key={speed} value={String(speed)}>{speed}×</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <small className="editor-animation-help">Frame selection, delay, duplicate and delete controls are available in the timeline under the preview.</small>
            </section>
          )}

          <section className="editor-control-group">
            <div className="editor-control-heading"><strong>Crop & position</strong><small>Fit, fill, zoom and drag</small></div>
            <div className="editor-segmented">
              <button type="button" className={settings.fitMode === 'contain' ? 'is-active' : ''} onClick={() => commit({ fitMode: 'contain', panX: 0, panY: 0 })}>Fit</button>
              <button type="button" className={settings.fitMode === 'cover' ? 'is-active' : ''} onClick={() => commit({ fitMode: 'cover', panX: 0, panY: 0 })}>Fill / crop</button>
            </div>
            <label className="editor-range"><span>Zoom <strong>{Math.round(settings.zoom)}%</strong></span><input {...sliderProps} type="range" min="25" max="300" value={settings.zoom} onChange={(event) => transient({ zoom: Number(event.target.value) })} /></label>
            <label className="editor-range"><span>Padding <strong>{Math.round(settings.padding)}%</strong></span><input {...sliderProps} type="range" min="0" max="35" value={settings.padding} onChange={(event) => transient({ padding: Number(event.target.value) })} /></label>
          </section>

          <section className="editor-control-group">
            <div className="editor-control-heading"><strong>Transform</strong></div>
            <div className="editor-icon-actions">
              <button type="button" onClick={() => commit({ rotation: (settings.rotation - 90 + 360) % 360 })}><RotateCcw /><span>Left</span></button>
              <button type="button" onClick={() => commit({ rotation: (settings.rotation + 90) % 360 })}><RotateCw /><span>Right</span></button>
              <button type="button" className={settings.flipX ? 'is-active' : ''} onClick={() => commit({ flipX: !settings.flipX })}><FlipHorizontal2 /><span>Flip H</span></button>
              <button type="button" className={settings.flipY ? 'is-active' : ''} onClick={() => commit({ flipY: !settings.flipY })}><FlipVertical2 /><span>Flip V</span></button>
            </div>
          </section>

          <section className="editor-control-group">
            <div className="editor-control-heading"><strong>Output size</strong><small>Square emoji canvas</small></div>
            <div className="editor-size-presets">{PRESETS.map((size) => <button key={size} type="button" className={settings.size === size ? 'is-active' : ''} onClick={() => commit({ size })}>{size}</button>)}</div>
          </section>

          <section className="editor-control-group">
            <div className="editor-control-heading"><strong>Background</strong></div>
            <div className="editor-backgrounds">
              <button type="button" className={`editor-bg-swatch is-transparent ${settings.background === 'transparent' ? 'is-active' : ''}`} onClick={() => commit({ background: 'transparent' })} aria-label="Transparent background" />
              <button type="button" className={`editor-bg-swatch is-white ${settings.background === '#ffffff' ? 'is-active' : ''}`} onClick={() => commit({ background: '#ffffff' })} aria-label="White background" />
              <button type="button" className={`editor-bg-swatch is-black ${settings.background === '#000000' ? 'is-active' : ''}`} onClick={() => commit({ background: '#000000' })} aria-label="Black background" />
              <label className="editor-color-picker"><input type="color" value={customBackground} onChange={(event) => commit({ background: event.target.value })} /><span>Custom</span></label>
            </div>
          </section>

          <section className="editor-control-group editor-export-group">
            <div className="editor-control-heading"><strong>Export</strong></div>
            <div className="editor-format">
              <span>Format</span>
              <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)} className="editor-beui-select">
                <SelectTrigger className="editor-beui-select-trigger"><SelectValue /></SelectTrigger>
                <SelectContent className="editor-beui-select-content">
                  {source?.animated && <SelectItem value="gif">GIF · animated</SelectItem>}
                  <SelectItem value="png">PNG · current frame</SelectItem>
                  <SelectItem value="webp">WebP · current frame</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="editor-export-actions">
              <button type="button" className="is-primary" onClick={() => void download()} disabled={!source}><Download /><span>Download {format.toUpperCase()}</span></button>
              <button type="button" onClick={() => void copyPng()} disabled={!source}><Clipboard /><span>Copy PNG</span></button>
            </div>
            {status && <p className="editor-status" aria-live="polite">{status}</p>}
          </section>

          <a className="editor-browse-link" href={browseUrl}>Browse more emoji <span>→</span></a>
        </aside>
      </div>

      <div className="editor-mobile-actions">
        <button type="button" onClick={() => void copyPng()} disabled={!source}><Clipboard /><span>Copy</span></button>
        <button type="button" className="is-primary" onClick={() => void download()} disabled={!source}><Download /><span>Export {format.toUpperCase()}</span></button>
      </div>
    </div>
  );
}
