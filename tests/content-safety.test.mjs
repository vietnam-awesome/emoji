import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSensitiveEmojiRecords,
  isSensitiveEmojiRecord,
  isSensitiveText
} from '../scripts/lib/content-safety.mjs';

test('blocks explicit terms including concatenated names', () => {
  assert.equal(isSensitiveText('HentaiFuckUwU'), true);
  assert.equal(isSensitiveText('hentaianimatedtits'), true);
  assert.equal(isSensitiveText('rule34'), true);
  assert.equal(isSensitiveText('OnlyFansEmoji'), true);
});

test('does not block ordinary words that merely contain short substrings', () => {
  assert.equal(isSensitiveText('classic'), false);
  assert.equal(isSensitiveText('asset'), false);
  assert.equal(isSensitiveText('cocktail'), false);
  assert.equal(isSensitiveText('Sussex'), false);
});

test('checks catalog metadata and tags', () => {
  assert.equal(isSensitiveEmojiRecord({ name: 'safe', tags: ['reaction', 'nsfw'] }), true);
  assert.equal(isSensitiveEmojiRecord({ name: 'Party Parrot', category: 'Animals', tags: ['fun'] }), false);
});

test('filters blocked records from a mixed catalog', () => {
  const safe = { id: 'safe-1', name: 'Party Parrot' };
  const blocked = { id: 'blocked-1', name: 'HentaiExample' };
  const result = filterSensitiveEmojiRecords([safe, blocked]);

  assert.deepEqual(result.allowed, [safe]);
  assert.deepEqual(result.blocked, [blocked]);
});
