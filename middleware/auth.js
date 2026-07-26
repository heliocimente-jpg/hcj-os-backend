const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET em falta. Define-o no ficheiro .env antes de arrancar o servidor.');
}

// Hierarquia de permissões (RBAC) — igual à do frontend actual (admin > manager > technician > viewer)
const ROLE_RANK = { viewer: 0, technician: 1, manager: 2, admin: 3 };

function signToken(user) {
  return jwt.sign(
    { uid: user.id, org: user.org_id, permission: user.permission, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' } // sessão longa — equivalente à persistência de sessão que já existia no frontend
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sem sessão. Faz login novamente.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

// Uso: requireRole('manager') deixa passar manager e admin, bloqueia technician/viewer
function requireRole(minRole) {
  return (req, res, next) => {
    const have = ROLE_RANK[req.user?.permission] ?? -1;
    const need = ROLE_RANK[minRole] ?? 99;
    if (have < need) return res.status(403).json({ error: 'Sem permissão suficiente para esta ação.' });
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };
