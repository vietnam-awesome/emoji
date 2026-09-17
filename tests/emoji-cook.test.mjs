import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cookPage = await readFile(new URL('../src/pages/cook.astro', import.meta.url), 'utf8');
const cookClient = await readFile(new URL('../src/components/cook/EmojiCook.tsx', import.meta.url), 'utf8');
const cookCss = await readFile(new URL('../src/styles/cook.css', import.meta.url), 'utf8');
const editorPage = await readFile(new URL('../src/pages/editor.astro', import.meta.url), 'utf8');

test('Emoji Cook is a client-only public tool using local BeUI primitives', () => {
  assert.match(cookPage, /<EmojiCook editorUrl=\{editorUrl\} client:only="react"/);
  assert.match(cookClient, /from '\.\.\/motion\/button'/);
  assert.match(cookClient, /from '\.\.\/motion\/input'/);
  assert.match(cookClient, /from '\.\.\/motion\/select'/);
  assert.match(cookClient, /from '\.\.\/motion\/tabs'/);
  assert.match(cookClient, /ActionSwapIcon/);
  assert.doesNotMatch(cookClient, /fetch\(/);
});

test('Emoji Cook supports ingredient search, recipes, randomization and local export', () => {
  assert.match(cookClient, /const EMOJI_POOL/);
  assert.match(cookClient, /resolveStrategy/);
  assert.match(cookClient, /randomize/);
  assert.match(cookClient, /Explore recipes/);
  assert.match(cookClient, /canvas\.toBlob/);
  assert.match(cookClient, /image\/webp/);
  assert.match(cookClient, /ClipboardItem/);
  assert.match(cookClient, /history\.replaceState/);
});

test('Cook result can be handed off to the existing editor without a server upload', () => {
  assert.match(cookClient, /eplus-emoji-editor-handoff/);
  assert.match(cookClient, /sessionStorage\.setItem/);
  assert.match(cookClient, /handoff=cook/);
  assert.match(editorPage, /sessionStorage\.getItem\('eplus-emoji-editor-handoff'\)/);
  assert.match(editorPage, /url\.searchParams\.set\('src', source\)/);
});

test('Cook UI is responsive and keeps the preview usable on mobile', () => {
  assert.match(cookCss, /\.cook-workspace/);
  assert.match(cookCss, /@media \(max-width: 760px\)/);
  assert.match(cookCss, /@media \(max-width: 520px\)/);
  assert.match(cookCss, /\.cook-picker-grid/);
  assert.match(cookCss, /\.cook-result-actions/);
});
