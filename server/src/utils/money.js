const MAX_RUPEES = 100000; // per entry

// Converts a rupee amount (number or numeric string) to integer paise.
// Returns null when the value is not a valid positive amount.
function toPaise(value) {
  const num = typeof value === 'string' ? Number(value.replace(/[,₹\s]/g, '')) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) return null;
  const paise = Math.round(num * 100);
  if (paise < 1 || paise > MAX_RUPEES * 100) return null;
  return paise;
}

function formatRupees(paise) {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

module.exports = { toPaise, formatRupees, MAX_RUPEES };
