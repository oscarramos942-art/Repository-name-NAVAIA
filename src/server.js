import "dotenv/config";
import express from "express";
import cors from "cors";
import { chat } from "./navaia.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req,res)=>res.json({ok:true,service:"NAVAIA"}));

app.post("/ai/chat", async (req,res)=>{
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({error:"El mensaje es obligatorio."});
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY no configurada en el servidor."});
    const answer = await chat(message);
    res.json({answer});
  } catch (err) {
    console.error(err);
    res.status(500).json({error:"No fue posible consultar NAVAIA."});
  }
});

app.listen(port, "0.0.0.0", ()=>console.log(`NAVAIA backend activo en puerto ${port}`));