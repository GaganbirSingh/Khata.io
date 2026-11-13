// A small rule-based parser for Hinglish / English khata entries such as
//   "Ramesh ne 250 ka atta liya, 500 de diye"
// It runs without any AI service, so the app works with no API key and no
// personal data leaves the server. Gemini is used only when it is configured.

const NAME_MARKERS = ['ne', 'ko', 'se', 'ka', 'ki', 'ke', 'took', 'bought', 'paid', 'gave', 'owes', 'has', 'returned'];
const HINDI_MARKERS = ['ne', 'ko', 'se', 'ka', 'ki', 'ke'];
const UDHAAR_RE = /\b(udhaar|udhar|liya|liye|lia|le gaya|le gayi|le gaye|le liya|took|bought|kharida|kharidi|credit|baaki|baki)\b/;
const JAMA_RE = /\b(de diye|de diya|diye|diya|jama|paid|pay kiye|pay kiya|pay kar diye|mile|mila|lautaye|lauta diye|wapas|returned|received|chuka|chukaye|bhar diye|gave)\b/;
const VERB_WORDS = /\b(udhaar|udhar|liya|liye|lia|le|gaya|gayi|gaye|diya|diye|de|took|bought|kharida|kharidi|ka|ki|ke|of|for|the|aur|and|jama|paid|pay|kiye|kiya|mile|mila|rs|rupaye|rupees|rupay|rupee|baaki|baki)\b/g;

function normalise(text) {
  return String(text || '')
    .replace(/₹\s*/g, '')
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1')
    .replace(/\b(rs\.?|inr)\s*(?=\d)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(s) {
  return s.replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

function extractName(text) {
  const words = text.split(' ');
  for (let i = 0; i < Math.min(words.length, 4); i += 1) {
    const w = words[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/\d/.test(words[i]) || NAME_MARKERS.includes(w)) {
      if (i === 0) return { name: null, marker: null, rest: text };
      const name = words
        .slice(0, i)
        .join(' ')
        .replace(/[^\p{L}\s]/gu, '')
        .replace(/\s+\b(ji|jee|bhai|bhaiya|didi|aunty|uncle|sahab|saab)$/i, '')
        .trim();
      const marker = NAME_MARKERS.includes(w) ? w : null;
      // Hindi postpositions (ne/ko/se) are dropped; English verbs stay in the sentence.
      const keepMarker = marker && !HINDI_MARKERS.includes(marker);
      const rest = words.slice(marker && !keepMarker ? i + 1 : i).join(' ');
      return { name: name ? titleCase(name) : null, marker, rest };
    }
  }
  return { name: null, marker: null, rest: text };
}

function splitSegments(rest) {
  const raw = rest.split(/,|;|\.\s|\baur\b|\band\b|\bphir\b|\bthen\b/i).map((s) => s.trim()).filter(Boolean);
  const segments = [];
  for (const part of raw) {
    if (/\d/.test(part) || segments.length === 0) segments.push(part);
    else segments[segments.length - 1] += ', ' + part; // continuation like "atta, tel liya"
  }
  return segments;
}

function extractItems(segment) {
  const lower = segment.toLowerCase();
  let m = lower.match(/\d+(?:\.\d+)?\s*(?:ka|ki|ke|of)\s+(.+)/);
  if (!m) m = lower.match(/(.+?)\s+(?:for|ke liye)\s+\d/);
  if (!m) return '';
  return m[1]
    .replace(/\d+(?:\.\d+)?/g, ' ')
    .replace(VERB_WORDS, ' ')
    .replace(/[^\p{L}\s,]/gu, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim()
    .slice(0, 120);
}

function classify(segment, marker) {
  const lower = segment.toLowerCase();
  if (UDHAAR_RE.test(lower)) return { type: 'udhaar', sure: true };
  if (JAMA_RE.test(lower)) {
    // "Imran ko 300 diya" = the shop gave goods/money to Imran -> udhaar.
    if (marker === 'ko' && /\b(diya|diye|de diya|de diye|gave)\b/.test(lower)) return { type: 'udhaar', sure: true };
    return { type: 'jama', sure: true };
  }
  if (/\d+\s*(ka|ki|ke|of)\s+\p{L}/u.test(lower)) return { type: 'udhaar', sure: true };
  return { type: 'udhaar', sure: false };
}

function parseLocal(input) {
  const text = normalise(input);
  const result = { customerName: null, entries: [], needsCheck: false, warnings: [] };
  if (!text) {
    result.warnings.push('empty');
    return result;
  }
  if (!/[a-z]/i.test(text) && /\p{L}/u.test(text)) {
    result.warnings.push('script_not_supported');
    result.needsCheck = true;
    return result;
  }
  const { name, marker, rest } = extractName(text);
  result.customerName = name;
  if (!name) {
    result.needsCheck = true;
    result.warnings.push('no_name');
  }

  for (const segment of splitSegments(rest)) {
    const num = segment.match(/\d+(?:\.\d{1,2})?/);
    if (!num) continue;
    const amount = Number(num[0]);
    if (!(amount > 0) || amount > 100000) {
      result.needsCheck = true;
      result.warnings.push('bad_amount');
      continue;
    }
    const { type, sure } = classify(segment, marker);
    if (!sure) result.needsCheck = true;
    result.entries.push({ type, amount, items: extractItems(segment), sure });
  }
  if (result.entries.length === 0) {
    result.needsCheck = true;
    result.warnings.push('no_amount');
  }
  return result;
}

module.exports = { parseLocal, extractName, extractItems, classify, normalise };
