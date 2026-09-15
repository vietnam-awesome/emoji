import { isSensitiveText } from './content-safety.mjs';

export function isSensitiveImportCandidate(candidate = {}) {
  return isSensitiveText(
    candidate.name,
    candidate.slug,
    candidate.shortcode,
    candidate.category,
    candidate.categoryName,
    candidate.categorySlug,
    candidate.group,
    candidate.subgroup,
    candidate.tags || [],
    candidate.url,
    candidate.detailUrl,
    candidate.sourceUrl
  );
}

export function filterSensitiveImportCandidates(candidates = []) {
  const allowed = [];
  const blocked = [];
  for (const candidate of candidates) {
    (isSensitiveImportCandidate(candidate) ? blocked : allowed).push(candidate);
  }
  return { allowed, blocked };
}
