# NAVAIA Backend v1.0

Backend mínimo para conectar el prototipo de NAVAIA con la API de OpenAI.

## Requisitos
- Node.js 20+
- Una API key de OpenAI

## Instalación

```bash
npm install
```

Copia `.env.example` como `.env` y coloca tu clave:

```env
OPENAI_API_KEY=TU_CLAVE
PORT=3000
```

Nunca publiques `.env` ni pongas la clave dentro de la app móvil.

## Ejecutar

```bash
npm start
```

Prueba:

```bash
curl http://localhost:3000/health
```

Y el chat:

```bash
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola NAVAIA, explícame qué puedes hacer."}'
```

## Siguiente fase
Añadir autenticación, PostgreSQL/Supabase y herramientas controladas:
- create_client
- create_quotation
- create_project
- create_transaction
- get_financial_summary


## Deploy en Render

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/health`
- Secret requerido: `OPENAI_API_KEY`
- Modelo por defecto: `gpt-5.6-luna`

No coloques la clave de OpenAI dentro del código ni la envíes por el chat.
