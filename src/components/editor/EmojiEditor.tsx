import {
  Clipboard,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Move,
  Pause,
  Play,
  Redo2,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Undo2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../motion/select';

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
  frameCount: number;
};

type GifFrame = {
  canvas: HTMLCanvasElement;
  delay: number;
};

type DecodedGifFrame = {
  dims: { left: number; top: number; width: number; height: number };
  patch: Uint8ClampedArray;
  delay: number;
  disposalType: number;
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

async function decodeGif(blob: Blob, width: number, height: number): Promise<GifFrame[]> {
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

  const frames: GifFrame[] = [];
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
  const gifFramesRef = useRef<GifFrame[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const settingsRef = useRef<Settings>(DEFAULTS);
  const gestureRef = useRef<Settings | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; settings: Settings } | null>(null);

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [past, setPast] = useState<Settings[]>([]);
  const [future, setFuture] = useState<Settings[]>([]);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [gifSpeed, setGifSpeed] = useState(1);
  const [gifDuration, setGifDuration] = useState(0);

  const replace = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const commit = useCallback((patch: Partial<Settings>) => {
    const current = settingsRef.current;
    const next = { ...current, ...patch };
    if (equal(current, next)) return;
    setPast((items) => [...items, current].slice(-60));
    setFuture([]);
    replace(next);
  }, [replace]);

  const transient = useCallback((patch: Partial<Settings>) => {
    replace({ ...settingsRef.current, ...patch });
  }, [replace]);

  const beginGesture = () => {
    if (!gestureRef.current) gestureRef.current = settingsRef.current;
  };
  const endGesture = () => {
    const start = gestureRef.current;
    gestureRef.current = null;
    if (!start || equal(start, settingsRef.current)) return;
    setPast((items) => [...items, start].slice(-60));
    setFuture([]);
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([settingsRef.current, ...future].slice(0, 60));
    replace(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, settingsRef.current].slice(-60));
    replace(next);
  };

  const reset = () => {
    if (!equal(settingsRef.current, DEFAULTS)) {
      setPast((items) => [...items, settingsRef.current].slice(-60));
      setFuture([]);
    }
    replace(DEFAULTS);
    setCurrentFrame(0);
    setGifSpeed(1);
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
    let gifFrames: GifFrame[] = [];
    if (isGif) gifFrames = await decodeGif(blob, image.naturalWidth, image.naturalHeight);

    imageRef.current = image;
    gifFramesRef.current = gifFrames;
    const animated = gifFrames.length > 1;
    setSource({
      name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      bytes: blob.size,
      mime: blob.type || 'image/*',
      animated,
      frameCount: animated ? gifFrames.length : 1,
    });
    setGifDuration(animated ? gifFrames.reduce((total, frame) => total + frame.delay, 0) : 0);
    setCurrentFrame(0);
    setGifSpeed(1);
    setPlaying(animated);
    setFormat(animated ? 'gif' : 'png');
    if (animatedHint && !animated && !isGif) {
      setStatus('This animated format is currently loaded as a static frame. GIF editing is fully supported.');
    }
    replace(DEFAULTS);
    setPast([]);
    setFuture([]);
  }, [replace]);

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
    const frames = gifFramesRef.current;
    if (!frames.length) return;
    const delay = Math.max(20, Math.round((frames[currentFrame]?.delay || 100) / gifSpeed));
    const timer = window.setTimeout(() => {
      setCurrentFrame((index) => (index + 1) % frames.length);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [currentFrame, gifSpeed, playing, source?.animated]);

  const draw = useCallback((canvas: HTMLCanvasElement, size: number, drawableOverride?: CanvasImageSource) => {
    const context = canvas.getContext('2d');
    const current = settingsRef.current;
    const drawable = drawableOverride
      ?? gifFramesRef.current[currentFrame]?.canvas
      ?? imageRef.current
      ?? undefined;
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
  }, [currentFrame, source]);

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, settings.size);
  }, [draw, settings, source, currentFrame]);

  const makeGifBlob = useCallback(async () => {
    const frames = gifFramesRef.current;
    if (!source?.animated || !frames.length) throw new Error('Load an animated GIF before exporting GIF.');
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
        delay: Math.max(20, Math.round(frames[index].delay / gifSpeed)),
        repeat: 0,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(0, transparentIndex),
        dispose: transparentIndex >= 0 ? 2 : 1,
      });
      if (index % 6 === 0 || index === frames.length - 1) {
        setStatus(`Encoding GIF · ${index + 1}/${frames.length} frames`);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  }, [draw, gifSpeed, source?.animated]);

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
      setPast((items) => [...items, drag.settings].slice(-60));
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
  const frameDelay = source?.animated ? gifFramesRef.current[currentFrame]?.delay || 0 : 0;

  return (
    <div className="emoji-editor">
      <div className="editor-topbar">
        <div>
          <p className="eyebrow">Browser-based image tool</p>
          <h1>Emoji editor</h1>
          <p>Crop, resize, animate and export emoji locally in your browser.</p>
        </div>
        <div className="editor-history-actions">
          <button type="button" onClick={undo} disabled={!past.length}><Undo2 /><span>Undo</span></button>
          <button type="button" onClick={redo} disabled={!future.length}><Redo2 /><span>Redo</span></button>
          <button type="button" onClick={reset} disabled={!source}><RefreshCcw /><span>Reset</span></button>
        </div>
      </div>

      {source?.animated && (
        <div className="editor-notice">
          GIF editing is active. Crop, transform, resize and background changes are applied to every frame; animation speed is preserved unless you change it.
        </div>
      )}
      {error && <div className="editor-message" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      <div className="editor-workspace">
        <section className="editor-canvas-column">
          <div className="editor-canvas-toolbar">
            <div>
              <strong>{source?.name || 'No image selected'}</strong>
              <span>{source ? `${source.width}×${source.height}px · ${formatBytes(source.bytes)}${source.animated ? ` · ${source.frameCount} frames` : ''}` : 'Choose an emoji or upload an image.'}</span>
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
            {source?.animated && <span>Frame <strong>{currentFrame + 1}/{source.frameCount}</strong></span>}
          </div>
        </section>

        <aside className="editor-controls">
          {source?.animated && (
            <section className="editor-control-group editor-animation-group">
              <div className="editor-control-heading"><strong>Animation</strong><small>{source.frameCount} frames · {formatDuration(gifDuration)}</small></div>
              <div className="editor-animation-row">
                <button
                  type="button"
                  className="editor-animation-play"
                  onClick={() => setPlaying((value) => !value)}
                  aria-label={playing ? 'Pause GIF preview' : 'Play GIF preview'}
                >
                  {playing ? <Pause /> : <Play />}
                  <span>{playing ? 'Pause' : 'Play'}</span>
                </button>
                <div className="editor-animation-speed">
                  <span>Speed</span>
                  <Select value={String(gifSpeed)} onValueChange={(value) => setGifSpeed(Number(value))} className="editor-beui-select">
                    <SelectTrigger className="editor-beui-select-trigger"><SelectValue /></SelectTrigger>
                    <SelectContent className="editor-beui-select-content">
                      {GIF_SPEEDS.map((speed) => <SelectItem key={speed} value={String(speed)}>{speed}×</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="editor-range editor-frame-range">
                <span>Frame <strong>{currentFrame + 1}/{source.frameCount} · {formatDuration(frameDelay)}</strong></span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, source.frameCount - 1)}
                  value={currentFrame}
                  onChange={(event) => {
                    setPlaying(false);
                    setCurrentFrame(Number(event.target.value));
                  }}
                />
              </label>
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
                  <SelectItem value="png">PNG · lossless</SelectItem>
                  <SelectItem value="webp">WebP · smaller</SelectItem>
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
