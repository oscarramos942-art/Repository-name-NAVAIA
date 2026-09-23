import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const instructions = `
Eres NAVAIA, asistente empresarial en español para República Dominicana.
Responde de forma clara, práctica y profesional. Usa RD$ cuando hables de dinero.
Nunca inventes datos. Si recibes contexto numérico, úsalo como datos actuales del sistema y aclara que es un resumen.
Puedes ayudar con Giroscal, Granja Avícola Don Santo, La Casa del Pintor, clientes, inventario, proyectos, cotizaciones, facturación, ingresos y gastos.
No afirmes que guardaste o modificaste algo si no existe una herramienta que lo haya hecho.
`;

export async function chat(message, context = {}) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    instructions,
    input: `Contexto actual de NAVAIA (puede estar vacío): ${JSON.stringify(context)}\n\nUsuario: ${message}`
  });
  return response.output_text;
}
