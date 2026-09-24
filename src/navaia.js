import OpenAI from "openai";

const instructions = `
Eres NAVAIA, asistente empresarial en español para República Dominicana.

Responde de forma clara, práctica y profesional.
Usa RD$ cuando hables de dinero.

Nunca inventes datos.
Si recibes contexto numérico, úsalo como datos actuales del sistema.
Distingue entre datos registrados y estimaciones.

Puedes ayudar con:
- Giroscal
- Granja Avícola Don Santo
- La Casa del Pintor
- clientes
- inventario
- proyectos
- cotizaciones
- facturación
- ingresos
- gastos
- avicultura
- análisis empresarial
- precios de mercado
- costos
- márgenes
- variaciones por negocio

Cuando analices precios de mercado, indica la fecha de observación
y aclara que son referencias, no cotizaciones en tiempo real.

No afirmes que guardaste, modificaste o eliminaste información
si no existe una herramienta que realmente haya realizado esa acción.

Nunca reveles claves API, variables de entorno, errores internos,
códigos HTTP, información de autenticación ni detalles técnicos
del servidor al usuario.
`;

function money(n) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2
  }).format(Number(n || 0));
}

function localAnswer(message, context) {
  const q = String(message || "").trim().toLowerCase();

  const r = context?.resumen || {};

  const businesses = Array.isArray(context?.negocios)
    ? context.negocios
    : [];

  const inventory = Array.isArray(context?.inventario_priorizado)
    ? context.inventario_priorizado
    : [];

  const poultry = Array.isArray(context?.avicola)
    ? context.avicola
    : [];

  /*
   * IDENTIDAD DE NAVAIA
   */

  if (
    q.includes("cuál es tu nombre") ||
    q.includes("cual es tu nombre") ||
    q.includes("cómo te llamas") ||
    q.includes("como te llamas") ||
    q === "tu nombre"
  ) {
    return "Mi nombre es NAVAIA. Soy tu asistente empresarial.";
  }

  /*
   * SALUDOS
   */

  if (
    q === "hola" ||
    q.startsWith("hola ") ||
    q.includes("buenos días") ||
    q.includes("buenos dias") ||
    q.includes("buenas tardes") ||
    q.includes("buenas noches")
  ) {
    return "Hola. Soy NAVAIA, tu asistente empresarial. Estoy listo para ayudarte.";
  }

  /*
   * CAPACIDADES
   */

  if (
    q.includes("qué puedes hacer") ||
    q.includes("que puedes hacer") ||
    q.includes("qué haces") ||
    q.includes("que haces") ||
    q.includes("para qué sirves") ||
    q.includes("para que sirves")
  ) {
    return (
      "Soy NAVAIA, tu asistente empresarial. " +
      "Puedo ayudarte a consultar y analizar tus negocios, " +
      "incluyendo clientes, inventario, proyectos, cotizaciones, " +
      "facturación, ingresos, gastos y operaciones de la granja avícola."
    );
  }

  /*
   * INVENTARIO
   */

  if (
    q.includes("inventario") ||
    q.includes("stock") ||
    q.includes("productos bajos")
  ) {
    const low = inventory.filter(
      x => Number(x.stock) <= Number(x.min_stock)
    );

    if (!low.length) {
      return (
        "NAVAIA — análisis de inventario:\n\n" +
        "No encuentro productos por debajo de su stock mínimo " +
        "en los datos registrados actualmente."
      );
    }

    return (
      "NAVAIA — análisis de inventario:\n\n" +
      "Productos en nivel bajo:\n\n" +
      low
        .slice(0, 15)
        .map(
          x =>
            "- " +
            x.name +
            " (" +
            (x.business_name || "Negocio") +
            "): " +
            x.stock +
            " " +
            (x.unit || "unidad") +
            "; mínimo " +
            x.min_stock
        )
        .join("\n")
    );
  }

  /*
   * AVÍCOLA
   */

  if (
    q.includes("avícola") ||
    q.includes("avicola") ||
    q.includes("huevo") ||
    q.includes("huevos") ||
    q.includes("aves") ||
    q.includes("gallinas") ||
    q.includes("pollos")
  ) {
    const totalBirds = Number(r.birds || 0);
    const totalEggs = Number(r.eggs || 0);

    return (
      "NAVAIA — información avícola:\n\n" +
      "Aves registradas: " +
      totalBirds +
      "\n" +
      "Huevos registrados: " +
      totalEggs +
      "\n" +
      "Lotes registrados: " +
      poultry.length +
      "\n\n" +
      "Estos datos provienen de los registros actuales de NAVAIA."
    );
  }

  /*
   * RESUMEN EMPRESARIAL
   */

  const lines = businesses
    .map(
      b =>
        "- " +
        b.name +
        ": ingresos del mes " +
        money(b.month_income) +
        " · gastos " +
        money(b.month_expense)
    )
    .join("\n");

  return (
    "NAVAIA — resumen actual:\n\n" +
    "Negocios: " +
    (r.businesses ?? 0) +
    "\n" +
    "Clientes: " +
    (r.customers ?? 0) +
    "\n" +
    "Productos: " +
    (r.products ?? 0) +
    "\n" +
    "Aves: " +
    (r.birds ?? 0) +
    "\n" +
    "Ingresos del mes: " +
    money(r.income) +
    "\n" +
    "Gastos del mes: " +
    money(r.expense) +
    "\n\n" +
    "Detalle por negocio:\n" +
    (lines || "No hay movimientos registrados todavía.") +
    "\n\n" +
    "Este resumen utiliza los datos registrados actualmente en NAVAIA."
  );
}

export async function chat(message, context = {}) {
  /*
   * Primero resolvemos preguntas sencillas localmente.
   * Esto evita depender de OpenAI para funciones básicas.
   */

  const question = String(message || "").trim();

  if (!question) {
    return "Escribe una pregunta para NAVAIA.";
  }

  /*
   * Las preguntas básicas se responden sin llamar a OpenAI.
   */

  const basic = localAnswer(question, context);

  const q = question.toLowerCase();

  const isBasicQuestion =
    q.includes("cuál es tu nombre") ||
    q.includes("cual es tu nombre") ||
    q.includes("cómo te llamas") ||
    q.includes("como te llamas") ||
    q === "tu nombre" ||
    q === "hola" ||
    q.startsWith("hola ") ||
    q.includes("buenos días") ||
    q.includes("buenos dias") ||
    q.includes("buenas tardes") ||
    q.includes("buenas noches") ||
    q.includes("qué puedes hacer") ||
    q.includes("que puedes hacer") ||
    q.includes("qué haces") ||
    q.includes("que haces") ||
    q.includes("para qué sirves") ||
    q.includes("para que sirves");

  if (isBasicQuestion) {
    return basic;
  }

  /*
   * Si no existe la clave, usamos el funcionamiento local.
   */

  const rawApiKey = process.env.OPENAI_API_KEY;

  if (!rawApiKey) {
    return basic;
  }

  /*
   * Limpiamos espacios y comillas accidentales.
   */

  const apiKey = rawApiKey
    .trim()
    .replace(/^["']|["']$/g, "");

  if (!apiKey) {
    return basic;
  }

  /*
   * Configuración del cliente OpenAI.
   */

  const clientOptions = {
    apiKey
  };

  const organization = process.env.OPENAI_ORG_ID?.trim();
  const project = process.env.OPENAI_PROJECT_ID?.trim();

  if (organization) {
    clientOptions.organization = organization;
  }

  if (project) {
    clientOptions.project = project;
  }

  const client = new OpenAI(clientOptions);

  const model =
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.6-luna";

  try {
    const response = await client.responses.create({
      model,
      instructions,
      input:
        "Contexto actual de NAVAIA:\n" +
        JSON.stringify(context) +
        "\n\nUsuario:\n" +
        question
    });

    return (
      response.output_text ||
      basic
    );

  } catch (error) {

    /*
     * El error se registra únicamente en el servidor.
     * Nunca se muestra al usuario.
     */

    console.error("NAVAIA AI error:", {
      status: error?.status ?? null,
      code: error?.code ?? null,
      model
    });

    /*
     * Si OpenAI falla por cualquier motivo,
     * NAVAIA continúa funcionando con sus datos internos.
     */

    return basic;
  }
}