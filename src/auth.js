import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no configurado.");
  return process.env.JWT_SECRET;
}

function cleanUserInput({ name, email, password }) {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  if (!cleanName) throw new Error("El nombre es obligatorio.");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("El correo no es válido.");
  if (cleanPassword.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  return { cleanName, cleanEmail, cleanPassword };
}

async function insertUser({ name, email, password, role = "employee" }) {
  const { cleanName, cleanEmail, cleanPassword } = cleanUserInput({ name, email, password });
  const cleanRole = ["admin","manager","employee"].includes(role) ? role : "employee";
  const existing = await query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
  if (existing.rowCount) {
    const error = new Error("El correo ya está registrado.");
    error.code = "EMAIL_EXISTS";
    throw error;
  }
  const passwordHash = await bcrypt.hash(cleanPassword, 12);
  const result = await query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active, created_at",
    [cleanName, cleanEmail, passwordHash, cleanRole]
  );
  return result.rows[0];
}

export async function registerUser({ name, email, password }) {
  const count = await query("SELECT COUNT(*)::int AS total FROM users");
  return insertUser({ name, email, password, role: count.rows[0].total === 0 ? "admin" : "employee" });
}

export async function createManagedUser({ name, email, password, role }) {
  return insertUser({ name, email, password, role });
}

export async function updateManagedUser(id, { role, active }) {
  const values = [];
  const sets = [];
  if (role !== undefined) {
    if (!["admin","manager","employee"].includes(role)) throw new Error("Rol no válido.");
    values.push(role);
    sets.push(`role=$${values.length}`);
  }
  if (active !== undefined) {
    values.push(Boolean(active));
    sets.push(`active=$${values.length}`);
  }
  if (!sets.length) throw new Error("No hay cambios.");
  values.push(id);
  const r = await query(`UPDATE users SET ${sets.join(", ")}, updated_at=NOW() WHERE id=$${values.length} RETURNING id,name,email,role,active,created_at`, values);
  if (!r.rowCount) {
    const error = new Error("Usuario no encontrado.");
    error.code = "USER_NOT_FOUND";
    throw error;
  }
  return r.rows[0];
}

export async function loginUser({ email, password }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  const result = await query(
    "SELECT id, name, email, password_hash, role, active FROM users WHERE email = $1",
    [cleanEmail]
  );
  if (!result.rowCount || !result.rows[0].active) {
    const error = new Error("Correo o contraseña incorrectos.");
    error.code = "INVALID_LOGIN";
    throw error;
  }
  const user = result.rows[0];
  const valid = await bcrypt.compare(cleanPassword, user.password_hash);
  if (!valid) {
    const error = new Error("Correo o contraseña incorrectos.");
    error.code = "INVALID_LOGIN";
    throw error;
  }
  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    jwtSecret(),
    { expiresIn: "7d" }
  );
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Autenticación requerida." });
    req.auth = jwt.verify(token, jwtSecret());
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: "No tienes permisos para esta acción." });
    next();
  };
}
