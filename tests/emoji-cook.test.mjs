import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cookPage = await readFile(new URL('../src/pages/cook.astro', import.meta.url), 'utf8');
const cookClient = await readFile(new URL('../src/components/cook/EmojiCook.tsx', import.meta.url), 'utf8');
const cookCss = await readFile(new URL('../src/styles/cook.css', import.meta.url), 'utf8');
const editorClient = await readFile(new URL('../src/components/editor/EmojiEditor.tsx', import.meta.url), 'utf8');
const siteHeader = await readFile(new URL('../src/components/beui/SiteHeader.tsx', import.meta.url), 'utf8');

test('Emoji Cook is a client-only public tool using local BeUI primitives', () => {
  assert.match(cookPage, /<EmojiCook editorUrl=\{editorUrl\} client:only="react"/);
  assert.match(cookClient, /from '\.\.\/motion\/button'/);
  assert.match(cookClient, /from '\.\.\/motion\/input'/);
  assert.match(cookClient, /from '\.\.\/motion\/select'/);
  assert.match(cookClient, /from '\.\.\/motion\/tabs'/);
  assert.match(cookClient, /ActionSwapIcon/);
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

test('Cook is discoverable from the BeUI primary navigation', () => {
  assert.match(siteHeader, /label: 'Cook'/);
  assert.match(siteHeader, /routePath === '\/cook'/);
  assert.match(siteHeader, /const cookUrl/);
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
