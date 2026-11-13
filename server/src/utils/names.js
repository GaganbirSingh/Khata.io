// Helpers to match a spoken or handwritten name to an existing customer.

function nameKey(name) {
  return String(name || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\b(ji|jee|bhai|bhaiya|didi|aunty|uncle|sahab|saab)\b/g, ' ')
    .replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Returns { match, candidates } where match is a single confident customer
// (or null) and candidates are possible matches the shopkeeper should choose from.
function matchCustomer(rawName, customers) {
  const key = nameKey(rawName);
  if (!key) return { match: null, candidates: [] };
  const first = key.split(' ')[0];

  const exact = customers.filter((c) => c.nameKey === key);
  if (exact.length === 1) return { match: exact[0], candidates: [] };
  if (exact.length > 1) return { match: null, candidates: exact };

  const scored = [];
  for (const c of customers) {
    const cFirst = c.nameKey.split(' ')[0];
    let score = null;
    if (cFirst === key || c.nameKey.startsWith(key + ' ')) score = 1;
    else if (key.includes(' ') && cFirst === first) score = 2;
    else {
      const d = Math.min(levenshtein(key, c.nameKey), levenshtein(key, cFirst));
      const allowed = key.length >= 5 ? 2 : key.length >= 4 ? 1 : 0;
      if (d <= allowed) score = 2 + d;
    }
    if (score !== null) scored.push({ c, score });
  }
  scored.sort((a, b) => a.score - b.score);
  const best = scored.filter((s) => s.score === 1);
  // A unique exact first-name match wins; close spellings are only suggestions.
  if (best.length === 1) return { match: best[0].c, candidates: [] };
  return { match: null, candidates: scored.slice(0, 5).map((s) => s.c) };
}

module.exports = { nameKey, levenshtein, matchCustomer };
