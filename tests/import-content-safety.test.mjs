import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSensitiveImportCandidates,
  isSensitiveImportCandidate
} from '../scripts/lib/import-content-safety.mjs';

test('blocks explicit names before asset download', () => {
  assert.equal(isSensitiveImportCandidate({ name: 'HentaiFuckUwU' }), true);
  assert.equal(isSensitiveImportCandidate({ name: 'hentaianimatedtits' }), true);
  assert.equal(isSensitiveImportCandidate({ shortcode: ':rule34:' }), true);
});

test('blocks explicit URL slugs even when a name is not available yet', () => {
  assert.equal(isSensitiveImportCandidate({ detailUrl: 'https://emoji.gg/emoji/123-hentai-anime' }), true);
  assert.equal(isSensitiveImportCandidate({ url: 'https://example.test/emojis/nsfw_pack.gif' }), true);
});

test('keeps ordinary emoji candidates', () => {
  assert.equal(isSensitiveImportCandidate({ name: 'party_parrot', categoryName: 'Memes' }), false);
  assert.equal(isSensitiveImportCandidate({ name: 'cocktail', detailUrl: 'https://example.test/emojis/cocktail' }), false);
  assert.equal(isSensitiveImportCandidate({ name: 'classic', categorySlug: 'reactions' }), false);
});

test('partitions import candidates into allowed and blocked sets', () => {
  const result = filterSensitiveImportCandidates([
    { name: 'party_parrot' },
    { name: 'HentaiAnime' },
    { name: 'wave' }
  ]);
  assert.deepEqual(result.allowed.map((item) => item.name), ['party_parrot', 'wave']);
  assert.deepEqual(result.blocked.map((item) => item.name), ['HentaiAnime']);
});
