import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chat } from "./navaia.js";
import { query, initDb } from "./db.js";
import { registerUser, loginUser, requireAuth } from "./auth.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: process.env.ALLOWED_ORIGIN && process.env.ALLOWED_ORIGIN !== "*" ? process.env.ALLOWED_ORIGIN : true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "../public")));

const asyncRoute = (fn) => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const num = (v) => Number(v || 0);
const text = (v) => String(v ?? "").trim();
const allowed = (value, list, fallback) => list.includes(value) ? value : fallback;

app.get("/health", (_req,res) => res.json({ok:true,service:"NAVAIA",version:"2.0.0"}));
app.get("/health/db", asyncRoute(async (_req,res) => { await query("SELECT 1"); res.json({ok:true,database:"connected"}); }));

app.post("/auth/register", asyncRoute(async (req,res) => {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) return res.status(503).json({error:"Autenticación no configurada."});
  const user = await registerUser(req.body || {});
  res.status(201).json({user});
}));
app.post("/auth/login", asyncRoute(async (req,res) => {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) return res.status(503).json({error:"Autenticación no configurada."});
  res.json(await loginUser(req.body || {}));
}));
app.get("/auth/me", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("SELECT id,name,email,role,active,created_at FROM users WHERE id=$1",[req.auth.sub]);
  if(!r.rowCount || !r.rows[0].active) return res.status(401).json({error:"Usuario no disponible."});
  res.json({user:r.rows[0]});
}));

app.get("/api/businesses", requireAuth, asyncRoute(async (_req,res) => res.json((await query("SELECT * FROM businesses WHERE active=true ORDER BY name")).rows)));
app.post("/api/businesses", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("INSERT INTO businesses(name,type,description) VALUES($1,$2,$3) RETURNING *",[text(req.body.name),text(req.body.type)||"general",text(req.body.description)||null]);
  res.status(201).json(r.rows[0]);
}));

app.get("/api/customers", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("SELECT c.*,b.name business_name FROM customers c LEFT JOIN businesses b ON b.id=c.business_id WHERE ($1::uuid IS NULL OR c.business_id=$1) ORDER BY c.created_at DESC",[req.query.business_id||null]); res.json(r.rows);
}));
app.post("/api/customers", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("INSERT INTO customers(business_id,name,phone,email,address,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[req.body.business_id||null,text(req.body.name),text(req.body.phone)||null,text(req.body.email)||null,text(req.body.address)||null,text(req.body.notes)||null]); res.status(201).json(r.rows[0]);
}));

app.get("/api/products", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("SELECT p.*,b.name business_name FROM products p LEFT JOIN businesses b ON b.id=p.business_id WHERE ($1::uuid IS NULL OR p.business_id=$1) ORDER BY p.name",[req.query.business_id||null]); res.json(r.rows);
}));
app.post("/api/products", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("INSERT INTO products(business_id,name,sku,category,unit,stock,min_stock,cost,price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[req.body.business_id||null,text(req.body.name),text(req.body.sku)||null,text(req.body.category)||null,text(req.body.unit)||"unidad",num(req.body.stock),num(req.body.min_stock),num(req.body.cost),num(req.body.price)]); res.status(201).json(r.rows[0]);
}));

app.get("/api/projects", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("SELECT p.*,b.name business_name,c.name customer_name FROM projects p LEFT JOIN businesses b ON b.id=p.business_id LEFT JOIN customers c ON c.id=p.customer_id WHERE ($1::uuid IS NULL OR p.business_id=$1) ORDER BY p.created_at DESC",[req.query.business_id||null]); res.json(r.rows);
}));
app.post("/api/projects", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("INSERT INTO projects(business_id,customer_id,name,status,budget,start_date,due_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[req.body.business_id||null,req.body.customer_id||null,text(req.body.name),allowed(req.body.status,["planning","in_progress","paused","completed","cancelled"],"planning"),num(req.body.budget),req.body.start_date||null,req.body.due_date||null,text(req.body.notes)||null]); res.status(201).json(r.rows[0]);
}));

app.get("/api/transactions", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("SELECT t.*,b.name business_name FROM transactions t LEFT JOIN businesses b ON b.id=t.business_id WHERE ($1::uuid IS NULL OR t.business_id=$1) ORDER BY t.transaction_date DESC,t.created_at DESC LIMIT 200",[req.query.business_id||null]); res.json(r.rows);
}));
app.post("/api/transactions", requireAuth, asyncRoute(async (req,res) => {
  const type=allowed(req.body.type,["income","expense"],"expense");
  const r=await query("INSERT INTO transactions(business_id,type,category,description,amount,transaction_date) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[req.body.business_id||null,type,text(req.body.category)||"general",text(req.body.description),num(req.body.amount),req.body.transaction_date||new Date().toISOString().slice(0,10)]); res.status(201).json(r.rows[0]);
}));

app.get("/api/poultry", requireAuth, asyncRoute(async (req,res) => {
  const r=await query("SELECT p.*,b.name business_name FROM poultry_batches p LEFT JOIN businesses b ON b.id=p.business_id WHERE ($1::uuid IS NULL OR p.business_id=$1) ORDER BY p.created_at DESC",[req.query.business_id||null]); res.json(r.rows);
}));
app.post("/api/poultry", requireAuth, asyncRoute(async (req,res) => {
  const initial=Math.max(0,Math.trunc(num(req.body.initial_birds)));
  const r=await query("INSERT INTO poultry_batches(business_id,name,bird_type,initial_birds,current_birds,feed_kg,eggs_count,mortality,start_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",[req.body.business_id||null,text(req.body.name),text(req.body.bird_type)||"ponedoras",initial,Math.trunc(num(req.body.current_birds||initial)),num(req.body.feed_kg),Math.trunc(num(req.body.eggs_count)),Math.trunc(num(req.body.mortality)),req.body.start_date||new Date().toISOString().slice(0,10),text(req.body.notes)||null]); res.status(201).json(r.rows[0]);
}));

app.get("/api/quotations", requireAuth, asyncRoute(async (_req,res) => res.json((await query("SELECT q.*,b.name business_name,c.name customer_name FROM quotations q LEFT JOIN businesses b ON b.id=q.business_id LEFT JOIN customers c ON c.id=q.customer_id ORDER BY q.created_at DESC")).rows)));
app.post("/api/quotations", requireAuth, asyncRoute(async (req,res) => {
  const items=Array.isArray(req.body.items)?req.body.items:[];
  const subtotal=items.reduce((s,i)=>s+num(i.quantity)*num(i.unit_price),0), tax=num(req.body.tax), total=subtotal+tax;
  const number=text(req.body.number)||("COT-"+Date.now());
  const client=await (await import("./db.js")).pool.connect();
  try { await client.query("BEGIN"); const q=await client.query("INSERT INTO quotations(business_id,customer_id,number,status,subtotal,tax,total,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[req.body.business_id||null,req.body.customer_id||null,number,allowed(req.body.status,["draft","sent","accepted","rejected","expired"],"draft"),subtotal,tax,total,text(req.body.notes)||null]); for(const i of items) await client.query("INSERT INTO quotation_items(quotation_id,description,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5)",[q.rows[0].id,text(i.description),num(i.quantity)||1,num(i.unit_price),num(i.quantity||1)*num(i.unit_price)]); await client.query("COMMIT"); res.status(201).json(q.rows[0]); } catch(e){await client.query("ROLLBACK");throw e} finally{client.release()}
}));

app.get("/api/invoices", requireAuth, asyncRoute(async (_req,res) => res.json((await query("SELECT i.*,b.name business_name,c.name customer_name FROM invoices i LEFT JOIN businesses b ON b.id=i.business_id LEFT JOIN customers c ON c.id=i.customer_id ORDER BY i.created_at DESC")).rows)));
app.post("/api/invoices", requireAuth, asyncRoute(async (req,res) => {
  const items=Array.isArray(req.body.items)?req.body.items:[]; const subtotal=items.reduce((s,i)=>s+num(i.quantity)*num(i.unit_price),0),tax=num(req.body.tax),total=subtotal+tax,number=text(req.body.number)||("FAC-"+Date.now());
  const r=await query("INSERT INTO invoices(business_id,customer_id,number,status,subtotal,tax,total,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[req.body.business_id||null,req.body.customer_id||null,number,allowed(req.body.status,["draft","issued","paid","cancelled"],"issued"),subtotal,tax,total,req.body.due_date||null]); res.status(201).json(r.rows[0]);
}));

app.get("/api/reminders", requireAuth, asyncRoute(async (req,res)=>res.json((await query("SELECT * FROM reminders WHERE user_id=$1 ORDER BY due_at",[req.auth.sub])).rows)));
app.post("/api/reminders", requireAuth, asyncRoute(async (req,res)=>{const r=await query("INSERT INTO reminders(user_id,title,due_at) VALUES($1,$2,$3) RETURNING *",[req.auth.sub,text(req.body.title),req.body.due_at]);res.status(201).json(r.rows[0])}));

app.get("/api/dashboard", requireAuth, asyncRoute(async (_req,res) => {
  const [b,c,p,proj,fin,exp,eggs,birds]=await Promise.all([
    query("SELECT COUNT(*)::int count FROM businesses WHERE active=true"),
    query("SELECT COUNT(*)::int count FROM customers"),
    query("SELECT COUNT(*)::int count FROM products"),
    query("SELECT COUNT(*)::int count FROM projects WHERE status IN ('planning','in_progress','paused')"),
    query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='income' AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)"),
    query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='expense' AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)"),
    query("SELECT COALESCE(SUM(eggs_count),0) total FROM poultry_batches"),
    query("SELECT COALESCE(SUM(current_birds),0) total FROM poultry_batches")
  ]);
  res.json({businesses:b.rows[0].count,customers:c.rows[0].count,products:p.rows[0].count,activeProjects:proj.rows[0].count,monthIncome:num(fin.rows[0].total),monthExpense:num(exp.rows[0].total),eggs:num(eggs.rows[0].total),birds:num(birds.rows[0].total)});
}));

app.post("/ai/chat", requireAuth, asyncRoute(async (req,res) => {
  const message=text(req.body?.message); if(!message)return res.status(400).json({error:"El mensaje es obligatorio."});
  if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:"OPENAI_API_KEY no configurada."});
  const d=await query("SELECT (SELECT COUNT(*) FROM customers) customers,(SELECT COUNT(*) FROM products) products,(SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='income' AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)) income,(SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='expense' AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)) expense,(SELECT COALESCE(SUM(current_birds),0) FROM poultry_batches) birds,(SELECT COALESCE(SUM(eggs_count),0) FROM poultry_batches) eggs");
  res.json({answer:await chat(message,d.rows[0])});
}));

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Error interno de NAVAIA."})});
app.get("*",(_req,res)=>res.sendFile(path.join(root,"../public/index.html")));

async function start(){try{await initDb();console.log("Base de datos inicializada.");}catch(e){console.error("DB init:",e.message)} app.listen(port,"0.0.0.0",()=>console.log("NAVAIA 2.0 activo en puerto "+port));}
start();
