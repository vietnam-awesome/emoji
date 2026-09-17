import { CopyPlus, EyeOff, MoreHorizontal, Pause, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../motion/bottom-sheet';
import { Button } from '../motion/button';
import { Checkbox } from '../motion/checkbox';
import { Input } from '../motion/input';
import { RangeSlider } from '../motion/range-slider';

export type GifTimelineFrame = {
  id: string;
  canvas: HTMLCanvasElement;
  delay: number;
  enabled: boolean;
  originalIndex: number;
};

type Props = {
  frames: GifTimelineFrame[];
  currentFrameId: string | null;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onCurrentFrameChange: (frameId: string) => void;
  onToggleFrame: (frameId: string, enabled: boolean) => void;
  onDuplicateFrame: (frameId: string) => void;
  onDeleteFrame: (frameId: string) => void;
  onDelayChange: (frameId: string, delay: number) => void;
  onEnableAll: () => void;
};

function FrameThumbnail({ frame }: { frame: GifTimelineFrame }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const size = 76;
    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);
    const scale = Math.min(size / frame.canvas.width, size / frame.canvas.height);
    const width = frame.canvas.width * scale;
    const height = frame.canvas.height * scale;
    context.drawImage(frame.canvas, (size - width) / 2, (size - height) / 2, width, height);
  }, [frame.canvas]);

  return <canvas ref={ref} aria-hidden="true" />;
}

function clampDelay(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(5000, Math.max(20, Math.round(value)));
}

export default function GifFrameTimeline({
  frames,
  currentFrameId,
  playing,
  onPlayingChange,
  onCurrentFrameChange,
  onToggleFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onDelayChange,
  onEnableAll,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const currentIndex = Math.max(0, frames.findIndex((frame) => frame.id === currentFrameId));
  const current = frames[currentIndex] ?? frames[0];
  const activeCount = frames.filter((frame) => frame.enabled).length;
  const [delayText, setDelayText] = useState(String(current?.delay ?? 100));

  useEffect(() => {
    setDelayText(String(current?.delay ?? 100));
  }, [current?.id, current?.delay]);

  if (!frames.length) return null;

  const commitDelay = () => {
    if (!current) return;
    const next = clampDelay(Number(delayText));
    setDelayText(String(next));
    if (next !== current.delay) onDelayChange(current.id, next);
  };

  const frameActions = current ? (
    <div className="gif-frame-actions-grid">
      <div className="gif-frame-delay-control">
        <Input
          label="Frame delay"
          type="number"
          min="20"
          max="5000"
          step="10"
          value={delayText}
          onChange={setDelayText}
          onBlur={commitDelay}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDelay();
              event.currentTarget.blur();
            }
          }}
          rightIcon={<span className="gif-frame-delay-unit">ms</span>}
          classNames={{ field: 'gif-frame-delay-field' }}
        />
      </div>
      <Checkbox
        checked={current.enabled}
        onCheckedChange={(checked) => onToggleFrame(current.id, checked)}
        label="Include in GIF"
        className="gif-frame-current-checkbox"
      />
      <div className="gif-frame-action-buttons">
        <Button variant="secondary" size="sm" onClick={() => onDuplicateFrame(current.id)}>
          <CopyPlus /> Duplicate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDeleteFrame(current.id)}
          disabled={frames.length <= 1}
          className="gif-frame-delete"
        >
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <section className="gif-timeline" aria-label="GIF frame timeline">
      <div className="gif-timeline-header">
        <div>
          <strong>Frames</strong>
          <span>{activeCount}/{frames.length} included</span>
        </div>
        <div className="gif-timeline-header-actions">
          {activeCount < frames.length && (
            <Button variant="ghost" size="sm" onClick={onEnableAll}>
              <RotateCcw /> Enable all
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPlayingChange(!playing)}
            aria-label={playing ? 'Pause GIF preview' : 'Play GIF preview'}
          >
            {playing ? <Pause /> : <Play />}
            {playing ? 'Pause' : 'Play'}
          </Button>
        </div>
      </div>

      <div className="gif-frame-scrubber">
        <span>Frame {currentIndex + 1}</span>
        <RangeSlider
          min={0}
          max={Math.max(0, frames.length - 1)}
          step={1}
          value={currentIndex}
          onValueChange={(index) => {
            onPlayingChange(false);
            const next = frames[index];
            if (next) onCurrentFrameChange(next.id);
          }}
          showTicks={frames.length <= 24}
          aria-label="GIF frame"
          formatValueText={(value) => `Frame ${value + 1} of ${frames.length}`}
          className="gif-frame-range"
        />
        <span>{frames.length}</span>
      </div>

      <div className="gif-frame-strip" role="list" aria-label="GIF frames">
        {frames.map((frame, index) => {
          const currentFrame = frame.id === current?.id;
          return (
            <article
              key={frame.id}
              role="listitem"
              className={`gif-frame-card${currentFrame ? ' is-current' : ''}${frame.enabled ? '' : ' is-disabled'}`}
            >
              <div className="gif-frame-card-top">
                <Checkbox
                  checked={frame.enabled}
                  onCheckedChange={(checked) => onToggleFrame(frame.id, checked)}
                  aria-label={`${checkedLabel(frame.enabled)} frame ${index + 1}`}
                />
                <span>#{String(index + 1).padStart(2, '0')}</span>
              </div>
              <button
                type="button"
                className="gif-frame-preview"
                onClick={() => {
                  onPlayingChange(false);
                  onCurrentFrameChange(frame.id);
                }}
                aria-current={currentFrame ? 'true' : undefined}
              >
                <FrameThumbnail frame={frame} />
                {!frame.enabled && <span className="gif-frame-disabled-overlay"><EyeOff />Excluded</span>}
              </button>
              <div className="gif-frame-card-meta">
                <span>{frame.delay} ms</span>
                {frame.originalIndex < 0 ? <span>Copy</span> : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="gif-frame-desktop-actions">{frameActions}</div>
      <Button variant="secondary" size="md" className="gif-frame-mobile-more" onClick={() => setSheetOpen(true)}>
        <MoreHorizontal /> Frame actions
      </Button>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        snapPoints={['auto', 0.72]}
        title={`Frame ${currentIndex + 1}`}
        description={current ? `${current.delay} ms · ${current.enabled ? 'Included' : 'Excluded from export'}` : undefined}
        className="gif-frame-bottom-sheet"
      >
        <div className="gif-frame-sheet-content">{frameActions}</div>
      </BottomSheet>
    </section>
  );
}

function checkedLabel(checked: boolean) {
  return checked ? 'Exclude' : 'Include';
}
