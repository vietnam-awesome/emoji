import baseEmojis from './emojis.json';

const shardModules = import.meta.glob('./emoji-shards/*.json', {
  eager: true,
  import: 'default'
});

const shardEmojis = Object.values(shardModules).flatMap((records) => Array.isArray(records) ? records : []);

const seen = new Set();
const emojis = [];
for (const emoji of [...baseEmojis, ...shardEmojis]) {
  if (!emoji?.id || seen.has(emoji.id)) continue;
  seen.add(emoji.id);
  emojis.push(emoji);
}

export default emojis;
