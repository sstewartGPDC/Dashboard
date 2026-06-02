// Treat a request as an API call if its original URL is under /api/ or it
// explicitly asks for JSON. Inside a mounted router req.path is rewritten to be
// relative (e.g. '/'), so we must use req.originalUrl here, not req.path.
function isApiRequest(req) {
  return req.originalUrl.startsWith('/api/') ||
    (req.headers.accept || '').includes('application/json');
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (isApiRequest(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  // For page requests, redirect to login
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
