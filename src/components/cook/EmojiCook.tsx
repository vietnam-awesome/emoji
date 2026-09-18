"use client";

import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  Link2,
  Pencil,
  Search,
  Share2,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSwapIcon } from '../motion/action-swap';
import { Button } from '../motion/button';
import { Input } from '../motion/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../motion/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../motion/tabs';

type CookEmoji = {
  emoji: string;
  label: string;
  category: string;
  keywords: string;
};

type CookStrategy = 'auto' | 'stack' | 'wear' | 'badge' | 'split' | 'surround' | 'inside' | 'repeat';
type CookBackground = 'transparent' | 'light' | 'dark';
type ExportFormat = 'png' | 'webp';
type IngredientSlot = 'first' | 'second';

interface Props {
  editorUrl: string;
}

const CANVAS_SIZE = 512;
const EDITOR_HANDOFF_KEY = 'eplus-emoji-editor-handoff';
const EDITOR_HANDOFF_NAME_KEY = 'eplus-emoji-editor-handoff-name';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const EMOJI_POOL: CookEmoji[] = [
  { emoji: '😀', label: 'Grinning face', category: 'Faces', keywords: 'happy smile grin' },
  { emoji: '😂', label: 'Tears of joy', category: 'Faces', keywords: 'laugh crying funny' },
  { emoji: '🤣', label: 'Rolling laugh', category: 'Faces', keywords: 'rofl laugh funny' },
  { emoji: '😊', label: 'Smiling face', category: 'Faces', keywords: 'happy blush smile' },
  { emoji: '😎', label: 'Cool face', category: 'Faces', keywords: 'sunglasses cool summer' },
  { emoji: '😍', label: 'Heart eyes', category: 'Faces', keywords: 'love crush heart' },
  { emoji: '🥰', label: 'Smiling hearts', category: 'Faces', keywords: 'love affection heart' },
  { emoji: '😘', label: 'Kiss face', category: 'Faces', keywords: 'kiss love heart' },
  { emoji: '🤔', label: 'Thinking face', category: 'Faces', keywords: 'think question hmm' },
  { emoji: '🙄', label: 'Eye roll', category: 'Faces', keywords: 'annoyed whatever eyes' },
  { emoji: '😴', label: 'Sleeping face', category: 'Faces', keywords: 'sleep tired zzz' },
  { emoji: '🤤', label: 'Drooling face', category: 'Faces', keywords: 'drool hungry delicious' },
  { emoji: '😭', label: 'Loudly crying', category: 'Faces', keywords: 'cry sad tears' },
  { emoji: '😡', label: 'Angry face', category: 'Faces', keywords: 'mad rage angry' },
  { emoji: '🤬', label: 'Swearing face', category: 'Faces', keywords: 'angry curse rage' },
  { emoji: '😱', label: 'Screaming face', category: 'Faces', keywords: 'shock scream fear' },
  { emoji: '🤯', label: 'Exploding head', category: 'Faces', keywords: 'mind blown shock wow' },
  { emoji: '🥳', label: 'Party face', category: 'Faces', keywords: 'celebrate party birthday' },
  { emoji: '🤡', label: 'Clown', category: 'Faces', keywords: 'clown funny circus' },
  { emoji: '💀', label: 'Skull', category: 'Faces', keywords: 'dead skull skeleton' },
  { emoji: '👻', label: 'Ghost', category: 'Faces', keywords: 'ghost spooky halloween' },
  { emoji: '👽', label: 'Alien', category: 'Faces', keywords: 'alien space ufo' },
  { emoji: '🤖', label: 'Robot', category: 'Faces', keywords: 'robot bot machine ai' },
  { emoji: '👍', label: 'Thumbs up', category: 'Gestures', keywords: 'like yes approve lgtm' },
  { emoji: '👎', label: 'Thumbs down', category: 'Gestures', keywords: 'dislike no reject' },
  { emoji: '👏', label: 'Clapping hands', category: 'Gestures', keywords: 'clap applause congrats' },
  { emoji: '🙌', label: 'Raised hands', category: 'Gestures', keywords: 'celebrate hooray hands' },
  { emoji: '🙏', label: 'Folded hands', category: 'Gestures', keywords: 'thanks please pray' },
  { emoji: '💪', label: 'Flexed biceps', category: 'Gestures', keywords: 'strong muscle power' },
  { emoji: '❤️', label: 'Red heart', category: 'Symbols', keywords: 'heart love red' },
  { emoji: '💔', label: 'Broken heart', category: 'Symbols', keywords: 'heart broken sad' },
  { emoji: '💖', label: 'Sparkling heart', category: 'Symbols', keywords: 'heart sparkle love' },
  { emoji: '💯', label: 'Hundred', category: 'Symbols', keywords: 'hundred perfect score' },
  { emoji: '🔥', label: 'Fire', category: 'Symbols', keywords: 'fire hot flame lit' },
  { emoji: '✨', label: 'Sparkles', category: 'Symbols', keywords: 'sparkle magic shiny' },
  { emoji: '⭐', label: 'Star', category: 'Symbols', keywords: 'star favorite shine' },
  { emoji: '⚡', label: 'Lightning', category: 'Symbols', keywords: 'lightning fast electric bolt' },
  { emoji: '💥', label: 'Collision', category: 'Symbols', keywords: 'boom explosion impact' },
  { emoji: '💫', label: 'Dizzy', category: 'Symbols', keywords: 'dizzy star spin' },
  { emoji: '🐱', label: 'Cat', category: 'Animals', keywords: 'cat kitty pet' },
  { emoji: '🐶', label: 'Dog', category: 'Animals', keywords: 'dog puppy pet' },
  { emoji: '🐸', label: 'Frog', category: 'Animals', keywords: 'frog green animal' },
  { emoji: '🐵', label: 'Monkey', category: 'Animals', keywords: 'monkey animal' },
  { emoji: '🐼', label: 'Panda', category: 'Animals', keywords: 'panda bear animal' },
  { emoji: '🐻', label: 'Bear', category: 'Animals', keywords: 'bear animal' },
  { emoji: '🦊', label: 'Fox', category: 'Animals', keywords: 'fox animal orange' },
  { emoji: '🐰', label: 'Rabbit', category: 'Animals', keywords: 'rabbit bunny animal' },
  { emoji: '🐯', label: 'Tiger', category: 'Animals', keywords: 'tiger cat animal' },
  { emoji: '🦁', label: 'Lion', category: 'Animals', keywords: 'lion king animal' },
  { emoji: '🐷', label: 'Pig', category: 'Animals', keywords: 'pig animal pink' },
  { emoji: '🐙', label: 'Octopus', category: 'Animals', keywords: 'octopus sea animal' },
  { emoji: '🍕', label: 'Pizza', category: 'Food', keywords: 'pizza food cheese' },
  { emoji: '🍔', label: 'Burger', category: 'Food', keywords: 'burger food hamburger' },
  { emoji: '🍟', label: 'Fries', category: 'Food', keywords: 'fries food potato' },
  { emoji: '🌮', label: 'Taco', category: 'Food', keywords: 'taco food mexican' },
  { emoji: '🍣', label: 'Sushi', category: 'Food', keywords: 'sushi food japanese' },
  { emoji: '🍩', label: 'Doughnut', category: 'Food', keywords: 'donut sweet dessert' },
  { emoji: '🍪', label: 'Cookie', category: 'Food', keywords: 'cookie sweet dessert' },
  { emoji: '🍰', label: 'Cake', category: 'Food', keywords: 'cake dessert birthday' },
  { emoji: '☕', label: 'Coffee', category: 'Food', keywords: 'coffee drink caffeine' },
  { emoji: '🍓', label: 'Strawberry', category: 'Food', keywords: 'strawberry fruit food' },
  { emoji: '🌈', label: 'Rainbow', category: 'Nature', keywords: 'rainbow colorful sky' },
  { emoji: '☀️', label: 'Sun', category: 'Nature', keywords: 'sun sunny weather' },
  { emoji: '🌙', label: 'Moon', category: 'Nature', keywords: 'moon night sleep' },
  { emoji: '☁️', label: 'Cloud', category: 'Nature', keywords: 'cloud weather sky' },
  { emoji: '❄️', label: 'Snowflake', category: 'Nature', keywords: 'snow cold winter ice' },
  { emoji: '🌸', label: 'Cherry blossom', category: 'Nature', keywords: 'flower blossom spring' },
  { emoji: '🍀', label: 'Four leaf clover', category: 'Nature', keywords: 'clover luck green' },
  { emoji: '👑', label: 'Crown', category: 'Objects', keywords: 'crown king queen royal' },
  { emoji: '🎩', label: 'Top hat', category: 'Objects', keywords: 'hat magic formal' },
  { emoji: '🕶️', label: 'Sunglasses', category: 'Objects', keywords: 'glasses cool accessory' },
  { emoji: '🎉', label: 'Party popper', category: 'Objects', keywords: 'party celebrate confetti' },
  { emoji: '🚀', label: 'Rocket', category: 'Objects', keywords: 'rocket ship space launch' },
  { emoji: '💻', label: 'Laptop', category: 'Objects', keywords: 'computer laptop dev code' },
  { emoji: '🎮', label: 'Game controller', category: 'Objects', keywords: 'game controller gaming' },
  { emoji: '🎵', label: 'Music note', category: 'Objects', keywords: 'music song note' },
  { emoji: '🔔', label: 'Bell', category: 'Objects', keywords: 'bell notification alert' },
];

const STRATEGIES: Array<{ value: CookStrategy; label: string }> = [
  { value: 'auto', label: 'Auto recipe' },
  { value: 'stack', label: 'Mash together' },
  { value: 'wear', label: 'Wear / top' },
  { value: 'badge', label: 'Corner badge' },
  { value: 'split', label: 'Side by side' },
  { value: 'surround', label: 'Surround' },
  { value: 'inside', label: 'Inside' },
  { value: 'repeat', label: 'Repeat pattern' },
];

const BACKGROUNDS: Array<{ value: CookBackground; label: string }> = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

const CATEGORIES = ['All', ...Array.from(new Set(EMOJI_POOL.map((item) => item.category)))];
const VISUAL_STRATEGIES = STRATEGIES.filter((item) => item.value !== 'auto');

const AUTO_STRATEGIES: CookStrategy[] = ['stack', 'wear', 'badge', 'split', 'surround', 'inside', 'repeat'];

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveStrategy(strategy: CookStrategy, first: string, second: string): CookStrategy {
  if (strategy !== 'auto') return strategy;
  return AUTO_STRATEGIES[hashString(`${first}:${second}`) % AUTO_STRATEGIES.length];
}

function findEmoji(value: string | null) {
  if (!value) return null;
  return EMOJI_POOL.find((item) => item.emoji === value) ?? null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'emoji';
}

function drawGlyph(
  context: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  size: number,
  rotation = 0,
  alpha = 1,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation * Math.PI / 180);
  context.globalAlpha = alpha;
  context.font = `${size}px ${EMOJI_FONT}`;

  // Color-emoji fonts have noticeably different baselines on Apple, Windows and
  // Android. Center using the measured painted bounds instead of relying on
  // textBaseline="middle", which is why the first Cook preview could look
  // vertically clipped or off-center on iPhone/Safari.
  const metrics = context.measureText(glyph);
  const left = Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : metrics.width / 2;
  const right = Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : metrics.width / 2;
  const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : size * 0.5;
  const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : size * 0.5;

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText(glyph, (left - right) / 2, (ascent - descent) / 2);
  context.restore();
}

function renderRecipe(
  canvas: HTMLCanvasElement,
  first: CookEmoji,
  second: CookEmoji,
  strategy: CookStrategy,
  background: CookBackground,
) {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (background === 'light') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  } else if (background === 'dark') {
    context.fillStyle = '#151515';
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  const resolved = resolveStrategy(strategy, first.emoji, second.emoji);
  switch (resolved) {
    case 'wear':
      drawGlyph(context, first.emoji, 256, 292, 278);
      drawGlyph(context, second.emoji, 256, 118, 138, -4);
      break;
    case 'badge':
      drawGlyph(context, first.emoji, 238, 242, 300);
      drawGlyph(context, second.emoji, 392, 390, 142, 8);
      break;
    case 'split':
      drawGlyph(context, first.emoji, 174, 258, 214, -5);
      drawGlyph(context, second.emoji, 338, 258, 214, 5);
      break;
    case 'surround': {
      drawGlyph(context, first.emoji, 256, 256, 245);
      const radius = 188;
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8 - Math.PI / 2;
        drawGlyph(
          context,
          second.emoji,
          256 + Math.cos(angle) * radius,
          256 + Math.sin(angle) * radius,
          72,
          index * 8,
          0.96,
        );
      }
      break;
    }
    case 'inside':
      drawGlyph(context, first.emoji, 256, 256, 338, 0, 0.98);
      drawGlyph(context, second.emoji, 256, 268, 126, 0, 0.98);
      break;
    case 'repeat': {
      const spots = [
        [150, 150, -8],
        [362, 150, 8],
        [150, 362, 8],
        [362, 362, -8],
      ] as const;
      spots.forEach(([x, y, rotation], index) => {
        drawGlyph(context, index % 2 === 0 ? first.emoji : second.emoji, x, y, 160, rotation);
      });
      drawGlyph(context, second.emoji, 256, 256, 116, 0, 0.96);
      break;
    }
    case 'stack':
    default:
      drawGlyph(context, first.emoji, 222, 270, 286, -7);
      drawGlyph(context, second.emoji, 324, 230, 222, 9, 0.98);
      break;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, format: ExportFormat) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('This browser could not encode the cooked emoji.')),
      format === 'webp' ? 'image/webp' : 'image/png',
      format === 'webp' ? 0.94 : undefined,
    );
  });
}

function RecipePreview({
  first,
  second,
  strategy,
  background = 'transparent',
  label,
}: {
  first: CookEmoji;
  second: CookEmoji;
  strategy: CookStrategy;
  background?: CookBackground;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) renderRecipe(ref.current, first, second, strategy, background);
  }, [first, second, strategy, background]);

  return (
    <div className="cook-page" data-cook-strategy={resolvedStrategy}>
      <header className="cook-hero">
        <p className="eyebrow">Emoji playground</p>
        <div className="cook-hero-row">
          <div>
            <h1>Cook emoji</h1>
            <p>Choose two emoji and get an instant mashup. Pick a different style only when you want a variation.</p>
          </div>
          <Button variant="secondary" size="md" ripple onClick={randomize}>
            <Shuffle className="size-4" aria-hidden="true" />
            Surprise me
          </Button>
        </div>
        <div className="cook-hero-meta" aria-label="Emoji Cook capabilities">
          <span>No upload</span>
          <span>Instant preview</span>
          <span>PNG + WebP</span>
          <span>Edit result</span>
        </div>
      </header>

      <section className="cook-equation" aria-label="Current emoji combination">
        <button
          type="button"
          className={`cook-equation-slot${activeSlot === 'first' ? ' is-active' : ''}`}
          aria-pressed={activeSlot === 'first'}
          onClick={() => {
            setActiveSlot('first');
            setTab('pick');
          }}
        >
          <span>Emoji A</span>
          <strong aria-hidden="true">{first.emoji}</strong>
          <small>{first.label}</small>
        </button>
        <span className="cook-equation-operator" aria-hidden="true">+</span>
        <button
          type="button"
          className={`cook-equation-slot${activeSlot === 'second' ? ' is-active' : ''}`}
          aria-pressed={activeSlot === 'second'}
          onClick={() => {
            setActiveSlot('second');
            setTab('pick');
          }}
        >
          <span>Emoji B</span>
          <strong aria-hidden="true">{second.emoji}</strong>
          <small>{second.label}</small>
        </button>
        <span className="cook-equation-operator cook-equation-equals" aria-hidden="true">=</span>
        <button
          type="button"
          className="cook-equation-result"
          onClick={() => document.querySelector('.cook-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          aria-label="Jump to cooked result"
        >
          <RecipePreview
            first={first}
            second={second}
            strategy={strategy}
            background={background}
            label="Current cooked emoji preview"
          />
          <span>Result</span>
        </button>
        <Button
          variant="secondary"
          size="icon"
          ripple
          className="cook-swap cook-equation-swap"
          aria-label="Swap ingredients"
          onClick={swapIngredients}
        >
          <ActionSwapIcon value={`${first.emoji}:${second.emoji}`} animation="roll" className="size-4">
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </ActionSwapIcon>
        </Button>
      </section>

      <div className="cook-workspace">
        <section className="cook-builder" aria-label="Emoji ingredients and recipe controls">
          <div className="cook-picker-topline">
            <div>
              <span className="section-kicker">Choose ingredient {activeSlot === 'first' ? 'A' : 'B'}</span>
              <h2>{activeSlot === 'first' ? first.emoji : second.emoji} {activeSlot === 'first' ? first.label : second.label}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActiveSlot(activeSlot === 'first' ? 'second' : 'first')}>
              Switch to {activeSlot === 'first' ? 'B' : 'A'}
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab} variant="segment" className="cook-tabs">
            <TabsList aria-label="Emoji Cook mode" className="cook-tabs-list">
              <TabsTrigger value="pick">Choose emoji</TabsTrigger>
              <TabsTrigger value="explore">Combos</TabsTrigger>
            </TabsList>

            <TabsContent value="pick" className="cook-tab-panel">
              <Input
                type="search"
                value={query}
                onChange={setQuery}
                placeholder="Search smile, cat, fire, food…"
                aria-label={`Search ingredient ${activeSlot === 'first' ? 'A' : 'B'}`}
                leftIcon={<Search aria-hidden="true" />}
                className="cook-search"
              />

              <Tabs value={category} onValueChange={setCategory} variant="pill" className="cook-category-tabs">
                <TabsList aria-label="Emoji categories" className="cook-category-list">
                  {CATEGORIES.map((item) => (
                    <TabsTrigger key={item} value={item}>{item}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="cook-picker-heading">
                <span>{filteredEmoji.length} emoji</span>
                <span>Tap one to set {activeSlot === 'first' ? 'A' : 'B'}</span>
              </div>
              <div className="cook-picker-grid" role="list" aria-label="Available emoji ingredients">
                {filteredEmoji.map((item) => {
                  const selected = activeSlot === 'first' ? item.emoji === first.emoji : item.emoji === second.emoji;
                  return (
                    <button
                      key={`${item.emoji}-${item.label}`}
                      type="button"
                      role="listitem"
                      className={`cook-picker-item${selected ? ' is-selected' : ''}`}
                      onClick={() => chooseIngredient(item)}
                      title={`${item.label} · ${item.category}`}
                      aria-label={`Use ${item.label} as ${activeSlot === 'first' ? 'ingredient A' : 'ingredient B'}`}
                    >
                      <span aria-hidden="true">{item.emoji}</span>
                      <small>{item.label}</small>
                    </button>
                  );
                })}
              </div>
              {!filteredEmoji.length ? <p className="cook-empty">No matching emoji in this category. Clear the search or choose All.</p> : null}
            </TabsContent>

            <TabsContent value="explore" className="cook-tab-panel">
              <div className="cook-explore-copy">
                <div>
                  <span className="section-kicker">Combos with {first.emoji}</span>
                  <h2>See the result before choosing</h2>
                </div>
                <p>Unlike the first version, these cards render the actual local recipe preview instead of showing only A + B.</p>
              </div>
              <div className="cook-recipe-grid">
                {exploreEmoji.map((item) => (
                  <button
                    key={`recipe-${item.emoji}-${item.label}`}
                    type="button"
                    className="cook-recipe-card"
                    onClick={() => applyExplore(item)}
                    aria-label={`Cook ${first.label} with ${item.label}`}
                  >
                    <span className="cook-combo-preview">
                      <RecipePreview first={first} second={item} strategy="auto" />
                    </span>
                    <span className="cook-recipe-pair" aria-hidden="true">{first.emoji} + {item.emoji}</span>
                    <strong>{item.label}</strong>
                    <small>{resolveStrategy('auto', first.emoji, item.emoji)}</small>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="cook-controls" aria-label="Recipe options">
            <div className="cook-control">
              <span>Recipe style</span>
              <Select value={strategy} onValueChange={(value) => setStrategy(value as CookStrategy)}>
                <SelectTrigger><SelectValue placeholder="Choose style" /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="cook-control">
              <span>Background</span>
              <Select value={background} onValueChange={(value) => setBackground(value as CookBackground)}>
                <SelectTrigger><SelectValue placeholder="Choose background" /></SelectTrigger>
                <SelectContent>
                  {BACKGROUNDS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="cook-control">
              <span>Download format</span>
              <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                <SelectTrigger><SelectValue placeholder="Choose format" /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="cook-style-previews" aria-label="Recipe style previews">
            {VISUAL_STRATEGIES.map((item) => {
              const active = strategy === item.value || (strategy === 'auto' && resolvedStrategy === item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  className={`cook-style-preview${active ? ' is-active' : ''}`}
                  onClick={() => setStrategy(item.value)}
                  aria-pressed={active}
                >
                  <RecipePreview first={first} second={second} strategy={item.value} background={background} />
                  <span>{item.label}</span>
                  {active ? <Check className="size-3" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="cook-result" aria-label="Cooked emoji preview">
          <div className="cook-result-heading">
            <div>
              <span className="section-kicker">Cooked result</span>
              <h2>{first.emoji} + {second.emoji}</h2>
            </div>
            <span className="cook-strategy-badge"><Sparkles className="size-3" aria-hidden="true" /> {resolvedStrategy}</span>
          </div>

          <div className={`cook-canvas-shell${background === 'transparent' ? ' is-transparent' : ''}`}>
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              aria-label={`Cooked emoji using ${first.label} and ${second.label}`}
            />
          </div>

          <div className="cook-result-meta" aria-label="Output details">
            <span>512 × 512</span>
            <span>{background}</span>
            <span>{format.toUpperCase()}</span>
          </div>

          <div className="cook-result-actions">
            <Button variant="primary" size="md" ripple onClick={download}>
              <Download className="size-4" aria-hidden="true" />
              Download
            </Button>
            <Button variant="secondary" size="md" ripple onClick={editInEditor}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
            <Button variant="secondary" size="md" ripple onClick={copyImage}>
              <Copy className="size-4" aria-hidden="true" />
              Copy PNG
            </Button>
            <Button variant="ghost" size="md" onClick={shareRecipe}>
              {typeof navigator !== 'undefined' && navigator.share
                ? <Share2 className="size-4" aria-hidden="true" />
                : <Link2 className="size-4" aria-hidden="true" />}
              Share
            </Button>
          </div>

          {status ? <p className="cook-status" role="status">{status}</p> : null}
          {error ? <p className="cook-error" role="alert">{error}</p> : null}

          <p className="cook-local-note">
            This tool composes standard Unicode emoji locally with your browser's emoji renderer. It does not copy Google Emoji Kitchen artwork or remix third-party catalog assets.
          </p>
        </aside>
      </div>
    </div>
  );
}
