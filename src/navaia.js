import OpenAI from "openai";

const instructions = `
Eres NAVAIA, asistente empresarial en español para República Dominicana.
Responde de forma clara, práctica y profesional. Usa RD$ cuando hables de dinero.
Nunca inventes datos. Si recibes contexto numérico, úsalo como datos actuales del sistema y aclara que es un resumen.
Puedes ayudar con Giroscal, Granja Avícola Don Santo, La Casa del Pintor, clientes, inventario, proyectos, cotizaciones, facturación, ingresos y gastos.
No afirmes que guardaste o modificaste algo si no existe una herramienta que lo haya hecho.
`;

export async function chat(message, context = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY no configurada.");
    error.code = "OPENAI_NOT_CONFIGURED";
    throw error;
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

  try {
    const response = await client.responses.create({
      model,
      instructions,
      input: `Contexto actual de NAVAIA (puede estar vacío): ${JSON.stringify(context)}

Usuario: ${message}`
    });

    return response.output_text || "No recibí una respuesta de la IA.";
  } catch (error) {
    error.navaia = { model, status: error?.status ?? null, code: error?.code ?? null };
    throw error;
  }
}
