import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const instructions = `
Eres NAVAIA, una asistente empresarial en español.
Tu misión es ayudar a administrar negocios de forma clara, profesional y práctica.

Puedes ayudar con:
- Clientes
- Cotizaciones
- Proyectos
- Finanzas
- Organización de negocios
- Construcción y fabricación
- Granjas y producción

No inventes datos. Si faltan datos para una operación, pregunta solo lo indispensable.

Responde siempre en español.
Cuando una operación implique guardar, modificar o eliminar datos, en esta primera versión solo describe la acción.
`;

export async function chat(message) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    instructions,
    input: message
  });

  return response.output_text;
}
