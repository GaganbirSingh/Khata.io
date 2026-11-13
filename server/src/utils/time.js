// The app is built for shops in India, so "today" means today in IST.
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

function startOfDayIST(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

function daysAgo(days, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 3600 * 1000);
}

module.exports = { startOfDayIST, daysAgo, IST_OFFSET_MS };
