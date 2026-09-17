"use client";

import {
  ArrowLeftRight,
  Copy,
  Download,
  Pencil,
  Search,
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
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${size}px ${EMOJI_FONT}`;
  context.fillText(glyph, 0, 0);
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

export default function EmojiCook({ editorUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [first, setFirst] = useState<CookEmoji>(EMOJI_POOL.find((item) => item.emoji === '😎') ?? EMOJI_POOL[0]);
  const [second, setSecond] = useState<CookEmoji>(EMOJI_POOL.find((item) => item.emoji === '🔥') ?? EMOJI_POOL[1]);
  const [activeSlot, setActiveSlot] = useState<IngredientSlot>('first');
  const [strategy, setStrategy] = useState<CookStrategy>('auto');
  const [background, setBackground] = useState<CookBackground>('transparent');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('pick');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryFirst = findEmoji(params.get('a'));
    const querySecond = findEmoji(params.get('b'));
    const queryStrategy = params.get('style') as CookStrategy | null;
    const queryBackground = params.get('bg') as CookBackground | null;
    if (queryFirst) setFirst(queryFirst);
    if (querySecond) setSecond(querySecond);
    if (queryStrategy && STRATEGIES.some((item) => item.value === queryStrategy)) setStrategy(queryStrategy);
    if (queryBackground && BACKGROUNDS.some((item) => item.value === queryBackground)) setBackground(queryBackground);
    setInitialized(true);
  }, []);

  const resolvedStrategy = useMemo(
    () => resolveStrategy(strategy, first.emoji, second.emoji),
    [strategy, first.emoji, second.emoji],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    renderRecipe(canvasRef.current, first, second, strategy, background);
  }, [first, second, strategy, background]);

  useEffect(() => {
    if (!initialized) return;
    const url = new URL(window.location.href);
    url.searchParams.set('a', first.emoji);
    url.searchParams.set('b', second.emoji);
    if (strategy === 'auto') url.searchParams.delete('style');
    else url.searchParams.set('style', strategy);
    if (background === 'transparent') url.searchParams.delete('bg');
    else url.searchParams.set('bg', background);
    window.history.replaceState({}, '', url);
  }, [initialized, first, second, strategy, background]);

  const filteredEmoji = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return EMOJI_POOL;
    return EMOJI_POOL.filter((item) =>
      `${item.emoji} ${item.label} ${item.category} ${item.keywords}`.toLowerCase().includes(needle),
    );
  }, [query]);

  const exploreEmoji = useMemo(() => EMOJI_POOL
    .filter((item) => item.emoji !== first.emoji)
    .map((item) => ({ item, score: hashString(`${first.emoji}:${item.emoji}:explore`) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 16)
    .map(({ item }) => item), [first.emoji]);

  const chooseIngredient = (item: CookEmoji) => {
    if (activeSlot === 'first') setFirst(item);
    else setSecond(item);
    setStatus(`${item.label} added as ${activeSlot === 'first' ? 'ingredient A' : 'ingredient B'}.`);
    setError('');
  };

  const swapIngredients = () => {
    setFirst(second);
    setSecond(first);
    setStatus('Ingredients swapped.');
    setError('');
  };

  const randomize = () => {
    const firstIndex = Math.floor(Math.random() * EMOJI_POOL.length);
    let secondIndex = Math.floor(Math.random() * EMOJI_POOL.length);
    if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % EMOJI_POOL.length;
    setFirst(EMOJI_POOL[firstIndex]);
    setSecond(EMOJI_POOL[secondIndex]);
    setStrategy('auto');
    setStatus('Fresh recipe generated.');
    setError('');
  };

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setError('');
      const blob = await canvasBlob(canvas, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stem = `cook-${slugify(first.label)}-${slugify(second.label)}`;
      link.href = url;
      link.download = `${stem}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      setStatus(`Downloaded ${format.toUpperCase()} · ${CANVAS_SIZE}×${CANVAS_SIZE}.`);
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Download failed.');
    }
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (!('ClipboardItem' in window) || !navigator.clipboard?.write) {
        throw new Error('Image copy is not supported in this browser. Use Download instead.');
      }
      const blob = await canvasBlob(canvas, 'png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setError('');
      setStatus('Cooked emoji copied as PNG.');
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Copy failed.');
    }
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Link copy is not supported in this browser.');
      await navigator.clipboard.writeText(window.location.href);
      setError('');
      setStatus('Recipe link copied.');
    } catch (reason) {
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'Unable to copy this recipe link.');
    }
  };

  const editInEditor = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const name = `cook-${slugify(first.label)}-${slugify(second.label)}.png`;
      sessionStorage.setItem(EDITOR_HANDOFF_KEY, canvas.toDataURL('image/png'));
      sessionStorage.setItem(EDITOR_HANDOFF_NAME_KEY, name);
      window.location.href = `${editorUrl}?handoff=cook`;
    } catch {
      setError('The cooked emoji could not be handed off to the editor. Download it and upload it there instead.');
    }
  };

  const applyExplore = (item: CookEmoji) => {
    setSecond(item);
    setActiveSlot('second');
    setTab('pick');
    setStatus(`${first.label} + ${item.label} is ready to cook.`);
    setError('');
  };

  return (
    <div className="cook-page" data-cook-strategy={resolvedStrategy}>
      <header className="cook-hero">
        <p className="eyebrow">Emoji playground</p>
        <div className="cook-hero-row">
          <div>
            <h1>Cook emoji</h1>
            <p>Pick two Unicode emoji, choose a recipe style, then export a fresh mashup locally in your browser.</p>
          </div>
          <Button variant="secondary" size="md" ripple onClick={randomize}>
            <Shuffle className="size-4" aria-hidden="true" />
            Random cook
          </Button>
        </div>
        <div className="cook-hero-meta" aria-label="Emoji Cook capabilities">
          <span>No upload</span>
          <span>PNG + WebP</span>
          <span>Shareable recipes</span>
          <span>Edit result</span>
        </div>
      </header>

      <div className="cook-workspace">
        <section className="cook-builder" aria-label="Emoji ingredients and recipe controls">
          <div className="cook-ingredients">
            <button
              type="button"
              className={`cook-ingredient${activeSlot === 'first' ? ' is-active' : ''}`}
              aria-pressed={activeSlot === 'first'}
              onClick={() => setActiveSlot('first')}
            >
              <span className="cook-ingredient-kicker">Ingredient A</span>
              <span className="cook-ingredient-emoji" aria-hidden="true">{first.emoji}</span>
              <strong>{first.label}</strong>
            </button>

            <Button
              variant="secondary"
              size="icon"
              ripple
              className="cook-swap"
              aria-label="Swap ingredients"
              onClick={swapIngredients}
            >
              <ActionSwapIcon value={`${first.emoji}:${second.emoji}`} animation="roll" className="size-4">
                <ArrowLeftRight className="size-4" aria-hidden="true" />
              </ActionSwapIcon>
            </Button>

            <button
              type="button"
              className={`cook-ingredient${activeSlot === 'second' ? ' is-active' : ''}`}
              aria-pressed={activeSlot === 'second'}
              onClick={() => setActiveSlot('second')}
            >
              <span className="cook-ingredient-kicker">Ingredient B</span>
              <span className="cook-ingredient-emoji" aria-hidden="true">{second.emoji}</span>
              <strong>{second.label}</strong>
            </button>
          </div>

          <Tabs value={tab} onValueChange={setTab} variant="segment" className="cook-tabs">
            <TabsList aria-label="Emoji Cook picker mode" className="cook-tabs-list">
              <TabsTrigger value="pick">Pick emoji</TabsTrigger>
              <TabsTrigger value="explore">Explore recipes</TabsTrigger>
            </TabsList>

            <TabsContent value="pick" className="cook-tab-panel">
              <Input
                type="search"
                value={query}
                onChange={setQuery}
                placeholder={`Search ingredient ${activeSlot === 'first' ? 'A' : 'B'}`}
                aria-label={`Search ingredient ${activeSlot === 'first' ? 'A' : 'B'}`}
                leftIcon={<Search aria-hidden="true" />}
                className="cook-search"
              />
              <div className="cook-picker-heading">
                <span>{filteredEmoji.length} emoji</span>
                <span>Picking {activeSlot === 'first' ? 'ingredient A' : 'ingredient B'}</span>
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
              {!filteredEmoji.length ? <p className="cook-empty">No matching ingredient. Try a broader keyword.</p> : null}
            </TabsContent>

            <TabsContent value="explore" className="cook-tab-panel">
              <div className="cook-explore-copy">
                <div>
                  <span className="section-kicker">Explore with {first.emoji}</span>
                  <h2>Try another ingredient</h2>
                </div>
                <p>These recipes are generated from the local Unicode ingredient set. Pick one to return to the cooker.</p>
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
                    <span className="cook-recipe-glyphs" aria-hidden="true">{first.emoji}<b>+</b>{item.emoji}</span>
                    <span>{item.label}</span>
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
        </section>

        <aside className="cook-result" aria-label="Cooked emoji preview">
          <div className="cook-result-heading">
            <div>
              <span className="section-kicker">Fresh from the cooker</span>
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

          <div className="cook-result-actions">
            <Button variant="primary" size="md" ripple onClick={editInEditor}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit result
            </Button>
            <Button variant="secondary" size="md" ripple onClick={download}>
              <Download className="size-4" aria-hidden="true" />
              Download {format.toUpperCase()}
            </Button>
            <Button variant="secondary" size="md" ripple onClick={copyImage}>
              <Copy className="size-4" aria-hidden="true" />
              Copy PNG
            </Button>
            <Button variant="ghost" size="md" onClick={copyLink}>
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Copy recipe link
            </Button>
          </div>

          {status ? <p className="cook-status" role="status">{status}</p> : null}
          {error ? <p className="cook-error" role="alert">{error}</p> : null}

          <p className="cook-local-note">
            Emoji Cook renders standard Unicode emoji with your browser/device emoji font. It does not remix third-party catalog artwork, and the generated image stays on your device unless you choose to share it.
          </p>
        </aside>
      </div>
    </div>
  );
}
