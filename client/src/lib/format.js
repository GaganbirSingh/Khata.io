const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function rupees(value) {
  return `₹${inr.format(Math.abs(Number(value) || 0))}`;
}

export function shortDate(value) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}

export function longDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });
}

export function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export const LANGUAGES = [
  { value: 'hi', label: 'Hinglish' },
  { value: 'pa', label: 'Punjabi (English letters)' },
  { value: 'en', label: 'English' },
];

export const TONES = [
  { value: 'polite', label: 'Polite' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'firm', label: 'Firm' },
];

export const SHOP_TYPES = [
  { value: 'kirana', label: 'Kirana store' },
  { value: 'medical', label: 'Medical store' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'hardware', label: 'Hardware shop' },
  { value: 'other', label: 'Other' },
];
