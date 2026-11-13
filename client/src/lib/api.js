// Small fetch wrapper. Cookies are sent automatically (same origin);
// the session cookie is httpOnly, so JavaScript never sees it.
export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = 'GET', body, form, signal, quiet401 = false } = {}) {
  const opts = { method, credentials: 'same-origin', signal, headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('No internet connection. Please try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !quiet401) onUnauthorized();
    throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status, data.field);
  }
  return data;
}
