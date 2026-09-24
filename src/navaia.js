import OpenAI from "openai";

const instructions = `
Eres NAVAIA, asistente empresarial en español para República Dominicana.
Responde de forma clara, práctica y profesional. Usa RD$ cuando hables de dinero.
Nunca inventes datos. Si recibes contexto numérico, úsalo como datos actuales del sistema y aclara que es un resumen.
Puedes ayudar con Giroscal, Granja Avícola Don Santo, La Casa del Pintor, clientes, inventario, proyectos, cotizaciones, facturación, ingresos y gastos. También puedes analizar precios de mercado, costos, márgenes y variaciones por negocio.
No afirmes que guardaste o modificaste algo si no existe una herramienta que lo haya hecho. Cuando analices precios de mercado, indica siempre la fecha de observación y que son referencias; no los presentes como cotizaciones en tiempo real.
`;

function money(n){ return new Intl.NumberFormat("es-DO",{style:"currency",currency:"DOP",maximumFractionDigits:2}).format(Number(n||0)); }

function localAnswer(message, context, aiIssue=""){
  const q=String(message||"").toLowerCase();
  const r=context?.resumen||{};
  const businesses=Array.isArray(context?.negocios)?context.negocios:[];
  const inventory=Array.isArray(context?.inventario_priorizado)?context.inventario_priorizado:[];
  const poultry=Array.isArray(context?.avicola)?context.avicola:[];
  if(q.includes("inventario") || q.includes("stock")){
    const low=inventory.filter(x=>Number(x.stock)<=Number(x.min_stock));
    if(!low.length) return "NAVAIA — análisis local: no encuentro productos por debajo de su stock mínimo en los datos registrados.";
    return "NAVAIA — análisis local de inventario:\n\nProductos en nivel bajo:\n"+low.slice(0,15).map(x=>"- "+x.name+" ("+x.business_name+"): "+x.stock+" "+(x.unit||"unidad")+"; mínimo "+x.min_stock).join("\n");
  }
  if(q.includes("avícola") || q.includes("avicola") || q.includes("huevo") || q.includes("aves")){
    const totalBirds=Number(r.birds||0), totalEggs=Number(r.eggs||0);
    return "NAVAIA — análisis local avícola:"+(aiIssue?"\n\nDiagnóstico IA: "+aiIssue:"")+"\n\nAves registradas: "+totalBirds+"\nHuevos registrados: "+totalEggs+"\nLotes: "+poultry.length+"\n\nEstos datos provienen de los registros actuales de NAVAIA.";
  }
  const lines=businesses.map(b=>"- "+b.name+": ingresos del mes "+money(b.month_income)+" · gastos "+money(b.month_expense)).join("\n");
  return "NAVAIA — resumen del mes:"+(aiIssue?"\n\nDiagnóstico IA: "+aiIssue:"")+"\n\nNegocios: "+(r.businesses??0)+"\nClientes: "+(r.customers??0)+"\nProductos: "+(r.products??0)+"\nAves: "+(r.birds??0)+"\nIngresos del mes: "+money(r.income)+"\nGastos del mes: "+money(r.expense)+"\n\nDetalle por negocio:\n"+(lines||"No hay movimientos registrados todavía.")+"\n\nNota: este resultado fue generado con los datos internos de NAVAIA porque el servicio de IA externo no está autenticando actualmente.";
}

export async function chat(message, context = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return localAnswer(message, context);

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

  try {
    const response = await client.responses.create({
      model,
      instructions,
      input: `Contexto actual de NAVAIA (puede estar vacío): ${JSON.stringify(context)}

Usuario: ${message}`
    });
    return response.output_text || localAnswer(message, context);
  } catch (error) {
    error.navaia = { model, status: error?.status ?? null, code: error?.code ?? null };
    if (Number(error?.status) === 401) return localAnswer(message, context, "OpenAI rechazó la clave (HTTP 401). La clave de Render no está siendo aceptada.");
    if (Number(error?.status) === 429) return localAnswer(message, context, "OpenAI respondió HTTP 429: límite o cuota. La clave sí fue reconocida, pero la cuenta/proyecto no puede procesar la solicitud en este momento.");
    throw error;
  }
}
