import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editor = await readFile(new URL('../src/components/editor/EmojiEditor.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/editor-gif.css', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/editor.astro', import.meta.url), 'utf8');

test('GIF editor can reverse frame order with undo history', () => {
  assert.match(editor, /const reverseGifFrames = \(\) =>/);
  assert.match(editor, /pushHistory\(\)/);
  assert.match(editor, /\[\.\.\.frames\]\.reverse\(\)/);
  assert.match(editor, /Reverse frames/);
});

test('GIF export supports reduced palettes for smaller files', () => {
  assert.match(editor, /const GIF_COLOR_OPTIONS = \[256, 128, 64, 32\]/);
  assert.match(editor, /gifColorsRef\.current/);
  assert.match(editor, /quantize\(pixels, gifColorsRef\.current/);
  assert.match(editor, /Optimize smaller/);
  assert.match(editor, /GIF palette/);
});

test('editor exposes platform canvas presets', () => {
  assert.match(editor, /label: 'Discord', size: 128/);
  assert.match(editor, /label: 'Slack', size: 128/);
  assert.match(editor, /label: 'Twitch', size: 112/);
  assert.match(editor, /label: 'Telegram', size: 100/);
  assert.match(editor, /editor-platform-presets/);
  assert.match(css, /\.editor-platform-presets/);
});

test('editor metadata advertises reverse and optimization', () => {
  assert.match(page, /reverse and optimize animated GIFs/);
  assert.match(page, /palette size/);
});
