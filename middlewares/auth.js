function ensureAdmin(req, res, next) {
  if (!req.session.isAuthenticated) {
    return res.redirect("/admin-login");
  }
  next();
}

module.exports = {
  ensureAdmin,
};
