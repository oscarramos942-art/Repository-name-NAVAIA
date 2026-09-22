import "dotenv/config";
import express from "express";
import cors from "cors";
import { chat } from "./navaia.js";
import { query } from "./db.js";
import { registerUser, loginUser, requireAuth } from "./auth.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "NAVAIA", version: "1.2.0" });
});

app.get("/health/db", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error(err);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
      return res.status(503).json({ error: "La autenticación todavía no está configurada en el servidor." });
    }
    const user = await registerUser(req.body || {});
    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    if (err.code === "EMAIL_EXISTS") return res.status(409).json({ error: err.message });
    res.status(400).json({ error: err.message || "No fue posible crear el usuario." });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
      return res.status(503).json({ error: "La autenticación todavía no está configurada en el servidor." });
    }
    const result = await loginUser(req.body || {});
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.code === "INVALID_LOGIN" ? 401 : 400).json({
      error: err.message || "No fue posible iniciar sesión."
    });
  }
});

app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, name, email, role, active, created_at FROM users WHERE id = $1",
      [req.auth.sub]
    );
    if (!result.rowCount || !result.rows[0].active) {
      return res.status(401).json({ error: "Usuario no disponible." });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No fue posible consultar el usuario." });
  }
});

app.post("/ai/chat", requireAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "El mensaje es obligatorio." });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY no configurada en el servidor." });
    }
    const answer = await chat(message);
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No fue posible consultar NAVAIA." });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log("NAVAIA backend activo en puerto " + port);
});
