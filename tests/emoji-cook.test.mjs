import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cookPage = await readFile(new URL('../src/pages/kitchen.astro', import.meta.url), 'utf8');
const cookClient = await readFile(new URL('../src/components/cook/EmojiCook.tsx', import.meta.url), 'utf8');
const cookCss = await readFile(new URL('../src/styles/cook.css', import.meta.url), 'utf8');
const cookSkeleton = await readFile(new URL('../src/components/cook/CookSkeleton.astro', import.meta.url), 'utf8');
const pressableCard = await readFile(new URL('../src/components/motion/pressable-card.tsx', import.meta.url), 'utf8');
const editorClient = await readFile(new URL('../src/components/editor/EmojiEditor.tsx', import.meta.url), 'utf8');
const siteHeader = await readFile(new URL('../src/components/beui/SiteHeader.tsx', import.meta.url), 'utf8');

test('Emoji Kitchen is a client-only public tool using local BeUI primitives', () => {
  assert.match(cookPage, /<EmojiCook editorUrl=\{editorUrl\} client:only="react"/);
  assert.match(cookClient, /from '\.\.\/motion\/button'/);
  assert.match(cookClient, /from '\.\.\/motion\/input'/);
  assert.match(cookClient, /from '\.\.\/motion\/select'/);
  assert.match(cookClient, /from '\.\.\/motion\/tabs'/);
  assert.match(cookClient, /ActionSwapIcon/);
  assert.match(cookClient, /from '\.\.\/motion\/pressable-card'/);
  assert.match(cookClient, /TooltipLayer/);
  assert.match(cookClient, /data-beui-tooltip/);
  assert.match(pressableCard, /data-beui-pressable-card/);
  assert.match(pressableCard, /SPRING_PRESS/);
  assert.match(pressableCard, /useHoverCapable/);
  assert.doesNotMatch(cookClient, /fetch\(/);
});

test('Emoji Cook uses a combination-first picker with visual combo previews', () => {
  assert.match(cookClient, /const EMOJI_POOL/);
  assert.match(cookClient, /const \[category, setCategory\]/);
  assert.match(cookClient, /const CATEGORIES/);
  assert.match(cookClient, /setActiveSlot\('second'\)/);
  assert.match(cookClient, /See the result before choosing/);
  assert.match(cookClient, /RecipePreview/);
  assert.match(cookClient, /renderRecipe\(ref\.current, first, second, strategy, background, 160\)/);
  assert.match(cookClient, /cook-equation/);
});

test('Emoji Cook supports recipes, randomization, sharing and local export', () => {
  assert.match(cookClient, /resolveStrategy/);
  assert.match(cookClient, /const randomize =/);
  assert.match(cookClient, /canvas\.toBlob/);
  assert.match(cookClient, /image\/webp/);
  assert.match(cookClient, /ClipboardItem/);
  assert.match(cookClient, /navigator\.share/);
  assert.match(cookClient, /history\.replaceState/);
  assert.match(cookClient, /actualBoundingBoxAscent/);
});

test('Cook result can be handed off to the existing editor without a server upload', () => {
  assert.match(cookClient, /eplus-emoji-editor-handoff/);
  assert.match(cookClient, /sessionStorage\.setItem/);
  assert.match(cookClient, /handoff=cook/);
  assert.match(editorClient, /sessionStorage\.getItem\(EDITOR_HANDOFF_KEY\)/);
  assert.match(editorClient, /await fetch\(dataUrl\)/);
  assert.match(editorClient, /cleanUrl\.searchParams\.delete\('handoff'\)/);
});

test('Kitchen is discoverable from the BeUI primary navigation', () => {
  assert.match(siteHeader, /label: 'Kitchen'/);
  assert.match(siteHeader, /routePath === '\/kitchen'/);
  assert.match(siteHeader, /const kitchenUrl/);
});

test('Cook UI is responsive and keeps the preview usable on mobile', () => {
  assert.match(cookCss, /\.cook-workspace/);
  assert.match(cookCss, /@media \(max-width: 760px\)/);
  assert.match(cookCss, /@media \(max-width: 520px\)/);
  assert.match(cookCss, /\.cook-picker-grid/);
  assert.match(cookCss, /\.cook-result-actions/);
  assert.match(cookCss, /\.cook-equation/);
  assert.match(cookCss, /\.cook-category-list/);
  assert.match(cookCss, /\.cook-style-previews/);
});


test('Cook card-sized interactions use the shared BEUI pressable surface', () => {
  assert.match(cookClient, /<PressableCard[\s\S]+cook-equation-slot/);
  assert.match(cookClient, /<PressableCard[\s\S]+cook-equation-result/);
  assert.match(cookClient, /<PressableCard[\s\S]+cook-picker-item/);
  assert.match(cookClient, /<PressableCard[\s\S]+cook-recipe-card/);
  assert.match(cookClient, /<PressableCard[\s\S]+cook-style-preview/);
  assert.match(cookCss, /\[data-beui-pressable-card\]/);
});


test('Cook renders an SSR skeleton while the client-only island hydrates', () => {
  assert.match(cookPage, /import CookSkeleton from '\.\.\/components\/cook\/CookSkeleton\.astro'/);
  assert.match(cookPage, /<CookSkeleton slot="fallback" \/>/);
  assert.match(cookSkeleton, /cook-skeleton/);
  assert.match(cookSkeleton, /Loading Emoji Kitchen/);
  assert.match(cookSkeleton, /Array\.from\(\{ length: 24 \}\)/);
  assert.match(cookCss, /cook-skeleton-shimmer/);
  assert.match(cookCss, /\.cook-skeleton-equation/);
  assert.match(cookCss, /\.cook-skeleton-picker-grid/);
  assert.match(cookCss, /prefers-reduced-motion/);
});
