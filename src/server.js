import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chat } from "./navaia.js";
import { query, initDb, pool } from "./db.js";
import { registerUser, loginUser, requireAuth, requireRole, createManagedUser, updateManagedUser } from "./auth.js";

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

// Empleados y permisos: solo administradores pueden gestionar usuarios.
app.get("/api/users", requireAuth, requireRole("admin"), asyncRoute(async (_req,res) => {
  res.json((await query("SELECT id,name,email,role,active,created_at FROM users ORDER BY created_at DESC")).rows);
}));
app.post("/api/users", requireAuth, requireRole("admin"), asyncRoute(async (req,res) => {
  const user=await createManagedUser(req.body || {});
  res.status(201).json({user});
}));
app.patch("/api/users/:id", requireAuth, requireRole("admin"), asyncRoute(async (req,res) => {
  if (req.params.id === req.auth.sub && req.body?.active === false) return res.status(400).json({error:"No puedes desactivar tu propio usuario."});
  res.json({user:await updateManagedUser(req.params.id, req.body || {})});
}));


// Panel de precios de mercado: referencias oficiales verificadas.
app.get("/api/market-prices", requireAuth, asyncRoute(async (_req,res) => {
  res.json({
    updated_at: "2026-09-22",
    sources: {
      exchange: "Banco Central de la República Dominicana",
      consumer: "Pro Consumidor / SIDIP 3.0",
      fuel: "MICM (referencia semanal)"
    },
    prices: [
      {id:"usd",name:"Dólar estadounidense",category:"Finanzas",unit:"USD",buy:59.2350,sell:59.6539,currency:"DOP",source:"Banco Central de la República Dominicana",source_url:"https://www.bancentral.gov.do/",observed_at:"2026-09-22",note:"Tasa de referencia publicada para el 22/09/2026."},
      {id:"egg_don_papito",name:"Huevos Don Papito",category:"Avícola",unit:"cartón 30 uds",average:254.75,currency:"DOP",source:"Pro Consumidor / SIDIP 3.0",source_url:"https://www.sidip.gob.do/categoria/182",observed_at:"2026-09-09"},
      {id:"egg_endy",name:"Huevos Endy",category:"Avícola",unit:"cartón 30 uds",average:279.75,currency:"DOP",source:"Pro Consumidor / SIDIP 3.0",source_url:"https://www.sidip.gob.do/categoria/182",observed_at:"2026-09-09"},
      {id:"egg_economicos",name:"Huevos Económicos",category:"Avícola",unit:"cartón 30 uds",average:205.37,currency:"DOP",source:"Pro Consumidor / SIDIP 3.0",source_url:"https://www.sidip.gob.do/categoria/182",observed_at:"2026-09-09"},
      {id:"egg_market",name:"Huevos de mercado",category:"Avícola",unit:"cartón 30 uds",average:188.57,currency:"DOP",source:"Pro Consumidor / SIDIP 3.0",source_url:"https://www.sidip.gob.do/categoria/34",observed_at:"2026-09-09"},
      {id:"chicken",name:"Pollo procesado",category:"Avícola",unit:"libra",average:81.43,currency:"DOP",source:"Pro Consumidor / SIDIP 3.0",source_url:"https://www.sidip.gob.do/categoria/34",observed_at:"2026-09-09"},
      {id:"fuel_premium",name:"Gasolina Premium",category:"Combustibles",unit:"galón",average:350.10,currency:"DOP",source:"MICM",source_url:"https://micm.gob.do/",observed_at:"2026-09-19",note:"Precio semanal 19–25/09/2026."},
      {id:"fuel_regular",name:"Gasolina Regular",category:"Combustibles",unit:"galón",average:315.50,currency:"DOP",source:"MICM",source_url:"https://micm.gob.do/",observed_at:"2026-09-19",note:"Precio semanal 19–25/09/2026."},
      {id:"diesel_regular",name:"Gasoil Regular",category:"Combustibles",unit:"galón",average:267.80,currency:"DOP",source:"MICM",source_url:"https://micm.gob.do/",observed_at:"2026-09-19",note:"Precio semanal 19–25/09/2026."},
      {id:"diesel_optimo",name:"Gasoil Óptimo",category:"Combustibles",unit:"galón",average:302.10,currency:"DOP",source:"MICM",source_url:"https://micm.gob.do/",observed_at:"2026-09-19",note:"Precio semanal 19–25/09/2026."},
      {id:"glp",name:"GLP",category:"Combustibles",unit:"galón",average:135.20,currency:"DOP",source:"MICM",source_url:"https://micm.gob.do/",observed_at:"2026-09-19",note:"Precio semanal 19–25/09/2026."}
    ]
  });
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
  const r=await query("INSERT INTO products(business_id,name,sku,category,unit,stock,min_stock,cost,price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[req.body.business_id||null,text(req.body.name),text(req.body.sku)||null,text(req.body.category)||null,text(req.body.unit)||"unidad",num(req.body.stock),num(req.body.min_stock),num(req.body.cost),num(req.body.price)]);
  if(num(req.body.stock)>0) await query("INSERT INTO inventory_movements(product_id,type,quantity,previous_stock,new_stock,reason) VALUES($1,'in',$2,0,$2,$3)",[r.rows[0].id,num(req.body.stock),"Stock inicial"]);
  res.status(201).json(r.rows[0]);
}));
app.post("/api/products/:id/movement", requireAuth, asyncRoute(async (req,res) => {
  const type=allowed(req.body.type,["in","out","adjustment"],"in");
  const quantity=Math.abs(num(req.body.quantity));
  if(!quantity) return res.status(400).json({error:"La cantidad debe ser mayor que cero."});
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const p=await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE",[req.params.id]);
    if(!p.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({error:"Producto no encontrado."}); }
    const current=num(p.rows[0].stock);
    const next=type==="in"?current+quantity:type==="out"?current-quantity:quantity;
    if(next<0) { await client.query("ROLLBACK"); return res.status(400).json({error:"No hay suficiente stock para realizar esta salida."}); }
    const updated=await client.query("UPDATE products SET stock=$1 WHERE id=$2 RETURNING *",[next,req.params.id]);
    await client.query("INSERT INTO inventory_movements(product_id,type,quantity,previous_stock,new_stock,reason) VALUES($1,$2,$3,$4,$5,$6)",[req.params.id,type,quantity,current,next,text(req.body.reason)||null]);
    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}));
app.get("/api/products/:id/movements", requireAuth, asyncRoute(async (req,res) => {
  res.json((await query("SELECT * FROM inventory_movements WHERE product_id=$1 ORDER BY created_at DESC LIMIT 100",[req.params.id])).rows);
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

async function syncDailyPoultryProduction() {
  const rows = (await query("SELECT p.id,p.business_id,p.eggs_count,b.name business_name FROM poultry_batches p LEFT JOIN businesses b ON b.id=p.business_id WHERE p.current_birds>0")).rows;
  const today = new Date().toISOString().slice(0,10);
  for (const batch of rows) {
    const daily = await query("SELECT COUNT(*)::int count FROM poultry_daily_production WHERE batch_id=$1 AND production_date=$2",[batch.id,today]);
    if (daily.rows[0].count) continue;
    // Si el lote ya tenía huevos registrados antes de activar la automatización,
    // tomamos ese valor como el registro inicial de hoy para no duplicarlo.
    if (num(batch.eggs_count) > 0) {
      await query("INSERT INTO poultry_daily_production(batch_id,production_date,eggs_count) VALUES($1,$2,$3)",[batch.id,today,Math.trunc(num(batch.eggs_count))]);
      continue;
    }
    const eggs = batch.business_name === "Granja Avícola Don Santo" ? 30 : 0;
    await query("INSERT INTO poultry_daily_production(batch_id,production_date,eggs_count) VALUES($1,$2,$3)",[batch.id,today,eggs]);
    if (eggs > 0) {
      await query("UPDATE poultry_batches SET eggs_count=eggs_count+$1 WHERE id=$2",[eggs,batch.id]);
      const product = await query("SELECT id,stock FROM products WHERE business_id=$1 AND lower(name)=lower('Huevos') ORDER BY created_at LIMIT 1",[batch.business_id]);
      if (product.rowCount) {
        const previous=num(product.rows[0].stock), next=previous+eggs;
        await query("UPDATE products SET stock=$1 WHERE id=$2",[next,product.rows[0].id]);
        await query("INSERT INTO inventory_movements(product_id,type,quantity,previous_stock,new_stock,reason) VALUES($1,'in',$2,$3,$4,$5)",[product.rows[0].id,eggs,previous,next,"Producción diaria de huevos"]);
      }
    }
  }
}
app.get("/api/poultry", requireAuth, asyncRoute(async (req,res) => {\n  await syncDailyPoultryProduction();
  const r=await query("SELECT p.*,b.name business_name FROM poultry_batches p LEFT JOIN businesses b ON b.id=p.business_id WHERE ($1::uuid IS NULL OR p.business_id=$1) ORDER BY p.created_at DESC",[req.query.business_id||null]); res.json(r.rows);
}));
app.post("/api/poultry", requireAuth, asyncRoute(async (req,res) => {
  const initial=Math.max(0,Math.trunc(num(req.body.initial_birds)));
  const r=await query("INSERT INTO poultry_batches(business_id,name,bird_type,initial_birds,current_birds,feed_kg,eggs_count,mortality,start_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",[req.body.business_id||null,text(req.body.name),text(req.body.bird_type)||"ponedoras",initial,Math.trunc(num(req.body.current_birds||initial)),num(req.body.feed_kg),Math.trunc(num(req.body.eggs_count)),Math.trunc(num(req.body.mortality)),req.body.start_date||new Date().toISOString().slice(0,10),text(req.body.notes)||null]); res.status(201).json(r.rows[0]);
}));

app.get("/api/quotations", requireAuth, asyncRoute(async (_req,res) => res.json((await query("SELECT q.*,b.name business_name,c.name customer_name FROM quotations q LEFT JOIN businesses b ON b.id=q.business_id LEFT JOIN customers c ON c.id=q.customer_id ORDER BY q.created_at DESC")).rows)));
app.post("/api/quotations", requireAuth, asyncRoute(async (req,res) => {
  const items=Array.isArray(req.body.items)?req.body.items:[]; const subtotal=items.reduce((s,i)=>s+num(i.quantity)*num(i.unit_price),0), tax=num(req.body.tax), total=subtotal+tax; const number=text(req.body.number)||("COT-"+Date.now());
  const client=await pool.connect();
  try { await client.query("BEGIN"); const q=await client.query("INSERT INTO quotations(business_id,customer_id,number,status,subtotal,tax,total,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[req.body.business_id||null,req.body.customer_id||null,number,allowed(req.body.status,["draft","sent","accepted","rejected","expired"],"draft"),subtotal,tax,total,text(req.body.notes)||null]); for(const i of items) await client.query("INSERT INTO quotation_items(quotation_id,description,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5)",[q.rows[0].id,text(i.description),num(i.quantity)||1,num(i.unit_price),num(i.quantity||1)*num(i.unit_price)]); await client.query("COMMIT"); res.status(201).json(q.rows[0]); } catch(e){await client.query("ROLLBACK");throw e} finally{client.release()}
}));

app.get("/api/invoices", requireAuth, asyncRoute(async (_req,res) => res.json((await query("SELECT i.*,b.name business_name,c.name customer_name FROM invoices i LEFT JOIN businesses b ON b.id=i.business_id LEFT JOIN customers c ON c.id=i.customer_id ORDER BY i.created_at DESC")).rows)));
app.post("/api/invoices", requireAuth, asyncRoute(async (req,res) => {
  const items=Array.isArray(req.body.items)?req.body.items:[]; const subtotal=items.reduce((s,i)=>s+num(i.quantity)*num(i.unit_price),0),tax=num(req.body.tax),total=subtotal+tax,number=text(req.body.number)||("FAC-"+Date.now());
  const client=await pool.connect();
  try { await client.query("BEGIN"); const inv=await client.query("INSERT INTO invoices(business_id,customer_id,number,status,subtotal,tax,total,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[req.body.business_id||null,req.body.customer_id||null,number,allowed(req.body.status,["draft","issued","paid","cancelled"],"issued"),subtotal,tax,total,req.body.due_date||null]); for(const i of items) await client.query("INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5)",[inv.rows[0].id,text(i.description),num(i.quantity)||1,num(i.unit_price),num(i.quantity||1)*num(i.unit_price)]); await client.query("COMMIT"); res.status(201).json(inv.rows[0]); } catch(e){await client.query("ROLLBACK");throw e} finally{client.release()}
}));

app.get("/api/reminders", requireAuth, asyncRoute(async (req,res)=>res.json((await query("SELECT * FROM reminders WHERE user_id=$1 ORDER BY done,due_at",[req.auth.sub])).rows)));
app.post("/api/reminders", requireAuth, asyncRoute(async (req,res)=>{const r=await query("INSERT INTO reminders(user_id,title,due_at) VALUES($1,$2,$3) RETURNING *",[req.auth.sub,text(req.body.title),req.body.due_at]);res.status(201).json(r.rows[0])}));
app.patch("/api/reminders/:id", requireAuth, asyncRoute(async (req,res)=>{const r=await query("UPDATE reminders SET done=$1 WHERE id=$2 AND user_id=$3 RETURNING *",[Boolean(req.body.done),req.params.id,req.auth.sub]);if(!r.rowCount)return res.status(404).json({error:"Recordatorio no encontrado."});res.json(r.rows[0])}));
app.delete("/api/reminders/:id", requireAuth, asyncRoute(async (req,res)=>{const r=await query("DELETE FROM reminders WHERE id=$1 AND user_id=$2",[req.params.id,req.auth.sub]);if(!r.rowCount)return res.status(404).json({error:"Recordatorio no encontrado."});res.status(204).end()}));

app.get("/api/dashboard", requireAuth, asyncRoute(async (_req,res) => {\n  await syncDailyPoultryProduction();
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

async function buildAIContext() {
  const [summary, businesses, inventory, poultry, quotes, invoices] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*) FROM businesses WHERE active=true)::int businesses,
      (SELECT COUNT(*) FROM customers)::int customers,
      (SELECT COUNT(*) FROM products WHERE active=true)::int products,
      (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='income' AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)) income,
      (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='expense' AND date_trunc('month',transaction_date)=date_trunc('month',CURRENT_DATE)) expense,
      (SELECT COALESCE(SUM(current_birds),0) FROM poultry_batches) birds,
      (SELECT COALESCE(SUM(eggs_count),0) FROM poultry_batches) eggs,
      (SELECT COUNT(*) FROM projects WHERE status='in_progress')::int active_projects`),
    query(`SELECT b.id,b.name,b.type,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.business_id=b.id AND t.type='income' AND date_trunc('month',t.transaction_date)=date_trunc('month',CURRENT_DATE)),0) month_income,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.business_id=b.id AND t.type='expense' AND date_trunc('month',t.transaction_date)=date_trunc('month',CURRENT_DATE)),0) month_expense,
      COALESCE((SELECT COUNT(*) FROM customers c WHERE c.business_id=b.id),0)::int customers,
      COALESCE((SELECT COUNT(*) FROM products p WHERE p.business_id=b.id AND p.active=true),0)::int products,
      COALESCE((SELECT COUNT(*) FROM projects p WHERE p.business_id=b.id AND p.status='in_progress'),0)::int active_projects
      FROM businesses b WHERE b.active=true ORDER BY b.name`),
    query(`SELECT p.name,p.stock,p.min_stock,p.cost,p.price,b.name business_name
      FROM products p LEFT JOIN businesses b ON b.id=p.business_id WHERE p.active=true ORDER BY p.stock-p.min_stock ASC,p.name LIMIT 100`),
    query(`SELECT p.name,p.bird_type,p.current_birds,p.eggs_count,p.feed_kg,p.mortality,b.name business_name
      FROM poultry_batches p LEFT JOIN businesses b ON b.id=p.business_id ORDER BY p.created_at DESC LIMIT 50`),
    query(`SELECT COUNT(*)::int count,COALESCE(SUM(total),0) total FROM quotations WHERE date_trunc('month',created_at)=date_trunc('month',CURRENT_DATE)`),
    query(`SELECT COUNT(*)::int count,COALESCE(SUM(total),0) total FROM invoices WHERE date_trunc('month',created_at)=date_trunc('month',CURRENT_DATE)`)
  ]);
  return {
    fecha: new Date().toISOString().slice(0,10),
    resumen: summary.rows[0],
    negocios: businesses.rows,
    inventario_priorizado: inventory.rows,
    avicola: poultry.rows,
    cotizaciones_mes: quotes.rows[0],
    facturas_mes: invoices.rows[0],
    precios_mercado: {
      dolar: {compra:59.2350,venta:59.6539,fecha:"2026-09-22"},
      huevos_carton_referencias: [
        {nombre:"Don Papito",precio:254.75,fecha:"2026-09-09"},
        {nombre:"Endy",precio:279.75,fecha:"2026-09-09"},
        {nombre:"Económicos",precio:205.37,fecha:"2026-09-09"},
        {nombre:"Mercado",precio:188.57,fecha:"2026-09-09"}
      ],
      pollo_libra:81.43,
      combustibles: {premium:350.10,regular:315.50,gasoil_regular:267.80,gasoil_optimo:302.10,glp:135.20,fecha:"2026-09-19"}
    }
  };
}

app.get("/api/ai/context", requireAuth, asyncRoute(async (_req,res) => {
  res.json(await buildAIContext());
}));

app.post("/ai/chat", requireAuth, asyncRoute(async (req,res) => {
  const message=text(req.body?.message);
  if(!message)return res.status(400).json({error:"El mensaje es obligatorio."});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"La IA no está configurada en el servidor."});

  const context=await buildAIContext();
  try {
    res.json({answer:await chat(message,context)});
  } catch (e) {
    console.error("NAVAIA AI:", {message:e?.message, status:e?.status ?? null, code:e?.code ?? null, model:e?.navaia?.model ?? null});
    const status = Number(e?.status);
    if (status === 401) return res.status(502).json({error:"La clave de OpenAI fue rechazada por el servicio. Revisa la configuración de OPENAI_API_KEY en Render."});
    if (status === 404) return res.status(502).json({error:"El modelo de IA configurado no está disponible para esta clave de OpenAI."});
    if (status === 429) return res.status(502).json({error:"OpenAI rechazó temporalmente la solicitud por límite o cuota."});
    return res.status(502).json({error:"NAVAIA no pudo comunicarse con el servicio de IA.",code:e?.code ?? "AI_REQUEST_FAILED"});
  }
}));

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Error interno de NAVAIA."})});
app.get("*",(_req,res)=>res.sendFile(path.join(root,"../public/index.html")));

async function start(){try{await initDb();console.log("Base de datos inicializada.");}catch(e){console.error("DB init:",e.message)} app.listen(port,"0.0.0.0",()=>console.log("NAVAIA 2.0 activo en puerto "+port));}
start();
