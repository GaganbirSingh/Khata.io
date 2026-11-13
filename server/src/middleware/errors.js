const config = require('../config');

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Never leaks stack traces or internal messages to users.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'CastError') return res.status(404).json({ error: 'Not found' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Some details are not valid' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Photo is too large (max 4 MB)' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500 && !config.isTest) console.error(err);
  const message = status >= 500 && !err.expose ? 'Something went wrong. Please try again.' : err.message;
  return res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
