const jwt = require("jsonwebtoken");
const { isTokenBlacklisted } = require("../lib/tokenBlacklist");

module.exports = async function authMiddleware(req, res, next) {
  // Try Authorization header first
  let token = null;
  const header = req.headers["authorization"];
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  // Fall back to httpOnly cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.jti) {
      return res
        .status(401)
        .json({ message: "Invalid token: missing token ID" });
    }
    if (await isTokenBlacklisted(payload.jti)) {
      return res.status(401).json({ message: "Token has been revoked" });
    }
    req.user = payload;
    next();
  } catch (err) {
    console.error("[auth] JWT verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
