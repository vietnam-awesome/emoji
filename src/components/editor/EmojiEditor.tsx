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

type FitMode = 'contain' | 'cover';
type ExportFormat = 'png' | 'webp';

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

interface Props {
  browseUrl: string;
}

const PRESETS = [32, 64, 128, 256, 512];
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
const fileStem = (name: string) => String(name || 'emoji')
  .replace(/\.[a-z0-9]+$/i, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'emoji';

export default function EmojiEditor({ browseUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
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
  };

  const loadBlob = useCallback(async (blob: Blob, name: string, animated: boolean) => {
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

    imageRef.current = image;
    setSource({
      name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      bytes: blob.size,
      mime: blob.type || 'image/*',
      animated,
    });
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

  const draw = useCallback((canvas: HTMLCanvasElement, size: number) => {
    const context = canvas.getContext('2d');
    const image = imageRef.current;
    const current = settingsRef.current;
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
    if (!image) return;

    const pad = size * clamp(current.padding, 0, 45) / 100;
    const available = Math.max(1, size - pad * 2);
    const quarterTurn = Math.abs(current.rotation % 180) === 90;
    const rotatedWidth = quarterTurn ? image.naturalHeight : image.naturalWidth;
    const rotatedHeight = quarterTurn ? image.naturalWidth : image.naturalHeight;
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
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    context.restore();
  }, []);

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, settings.size);
  }, [draw, settings, source]);

  const makeBlob = useCallback(async (target: ExportFormat) => {
    if (!imageRef.current) throw new Error('Choose an emoji or upload an image first.');
    const canvas = document.createElement('canvas');
    draw(canvas, settingsRef.current.size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode this image.')),
        target === 'webp' ? 'image/webp' : 'image/png',
        target === 'webp' ? 0.92 : undefined,
      );
    });
  }, [draw]);

  const download = async () => {
    try {
      setError('');
      setStatus('Preparing export…');
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
      setStatus('Copying image…');
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

  return (
    <div className="emoji-editor">
      <div className="editor-topbar">
        <div>
          <p className="eyebrow">Browser-based image tool</p>
          <h1>Emoji editor</h1>
          <p>Crop, resize and export emoji locally in your browser.</p>
        </div>
        <div className="editor-history-actions">
          <button type="button" onClick={undo} disabled={!past.length}><Undo2 /><span>Undo</span></button>
          <button type="button" onClick={redo} disabled={!future.length}><Redo2 /><span>Redo</span></button>
          <button type="button" onClick={reset} disabled={!source}><RefreshCcw /><span>Reset</span></button>
        </div>
      </div>

      {source?.animated && <div className="editor-notice">Animated GIF editing is not enabled yet. Export creates a static PNG or WebP frame.</div>}
      {error && <div className="editor-message" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

      <div className="editor-workspace">
        <section className="editor-canvas-column">
          <div className="editor-canvas-toolbar">
            <div>
              <strong>{source?.name || 'No image selected'}</strong>
              <span>{source ? `${source.width}×${source.height}px · ${formatBytes(source.bytes)}` : 'Choose an emoji or upload an image.'}</span>
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
          <div className="editor-canvas-meta"><span>Output <strong>{settings.size}×{settings.size}px</strong></span><span>Zoom <strong>{Math.round(settings.zoom)}%</strong></span></div>
        </section>

        <aside className="editor-controls">
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
            <label className="editor-format"><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}><option value="png">PNG · lossless</option><option value="webp">WebP · smaller</option></select></label>
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
        <button type="button" className="is-primary" onClick={() => void download()} disabled={!source}><Download /><span>Export</span></button>
      </div>
    </div>
  );
}
