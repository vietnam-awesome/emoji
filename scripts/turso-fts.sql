CREATE INDEX idx_emojis_fts ON emojis USING fts (
  name WITH tokenizer=ngram,
  shortcode WITH tokenizer=ngram,
  tags_search WITH tokenizer=ngram,
  category WITH tokenizer=default,
  source_label WITH tokenizer=default
) WITH (
  weights = 'name=5.0,shortcode=5.0,tags_search=2.0,category=1.0,source_label=0.5'
);
