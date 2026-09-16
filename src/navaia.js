import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const instructions = `
Eres NAVAIA, una asistente empresarial en español.
Tu misión es ayudar a administrar negocios de forma clara, profesional y práctica.
Puedes ayudar con clientes, cotizaciones, proyectos y finanzas.
No inventes datos. Si faltan datos para una operación, pregunta solo lo indispensable.
Cuando una operación implique guardar, modificar o eliminar datos, en esta primera versión solo describe la acción; la ejecución con base de datos se añadirá mediante herramientas seguras en la siguiente fase.
Responde en español y usa pesos dominicanos cuando el usuario indique RD$.
`;

export async function chat(message) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    instructions,
    input: message
  });
  return response.output_text;
}