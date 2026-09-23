import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 5,
});

export async function query(text, params = []) { return pool.query(text, params); }

export async function initDb() {
  if (!process.env.DATABASE_URL) return false;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const schema = await fs.readFile(path.join(dir, "../database/schema.sql"), "utf8");
  await pool.query(schema);
  await pool.query(`INSERT INTO businesses (name,type,description)
    SELECT * FROM (VALUES
      ('Giroscal','ebanisteria','Ebanistería y muebles modulares'),
      ('Granja Avícola Don Santo','avicola','Producción de huevos y aves'),
      ('La Casa del Pintor','pinturas','Venta de pinturas al por mayor y detalle')
    ) AS v(name,type,description)
    WHERE NOT EXISTS (SELECT 1 FROM businesses b WHERE lower(b.name)=lower(v.name))`);
  return true;
}
