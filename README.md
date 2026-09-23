# NAVAIA 2.0

Plataforma empresarial web para administrar múltiples negocios desde teléfono y computadora.

## Incluye
- Autenticación con bcrypt + JWT.
- PostgreSQL con inicialización automática del esquema.
- Dashboard general.
- Negocios: Giroscal, Granja Avícola Don Santo y La Casa del Pintor.
- Clientes.
- Inventario.
- Cotizaciones.
- Facturación.
- Ingresos y gastos.
- Proyectos.
- Control de lotes avícolas.
- Recordatorios.
- NAVAIA IA con contexto resumido de la base de datos.
- Interfaz web responsive servida por el mismo backend.

## Render
Runtime Node, build `npm install`, start `npm start`, health check `/health`.

Variables necesarias:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional; por defecto gpt-5.6-luna)
- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGIN` (opcional)

La aplicación crea las tablas automáticamente al iniciar si `DATABASE_URL` está disponible.

Nunca publiques claves, contraseñas o archivos .env.
