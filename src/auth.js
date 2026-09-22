import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no configurado.");
  return process.env.JWT_SECRET;
}

export async function registerUser({ name, email, password }) {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  if (!cleanName) throw new Error("El nombre es obligatorio.");
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("El correo no es válido.");
  if (cleanPassword.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const existing = await query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
  if (existing.rowCount) {
    const error = new Error("El correo ya está registrado.");
    error.code = "EMAIL_EXISTS";
    throw error;
  }

  const count = await query("SELECT COUNT(*)::int AS total FROM users");
  const role = count.rows[0].total === 0 ? "admin" : "employee";
  const passwordHash = await bcrypt.hash(cleanPassword, 12);

  const result = await query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at",
    [cleanName, cleanEmail, passwordHash, role]
  );

  return result.rows[0];
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

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
}

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Autenticación requerida." });
    }
    req.auth = jwt.verify(token, jwtSecret());
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }
}
