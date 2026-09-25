// NAVAIA - Módulo de Construcción
// Compatible con las tablas actuales de NAVAIA.

export function registerConstructionRoutes(app, { query, requireAuth, asyncRoute }) {
  const text = (value) => String(value ?? "").trim();

  const number = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  // LISTAR OBRAS
  app.get(
    "/api/construction/projects",
    requireAuth,
    asyncRoute(async (req, res) => {
      const result = await query(`
        SELECT
          cp.*,
          c.name AS customer_name,
          b.name AS business_name
        FROM construction_projects cp
        LEFT JOIN customers c ON c.id = cp.customer_id
        LEFT JOIN businesses b ON b.id = cp.business_id
        ORDER BY cp.created_at DESC
      `);

      res.json({
        projects: result.rows
      });
    })
  );

  // CREAR OBRA
  app.post(
    "/api/construction/projects",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const name = text(body.name);

      if (!name) {
        return res.status(400).json({
          error: "El nombre de la obra es obligatorio."
        });
      }

      const progress = Math.min(
        100,
        Math.max(0, number(body.progress))
      );

      const result = await query(
        `
        INSERT INTO construction_projects (
          business_id,
          customer_id,
          name,
          description,
          location,
          status,
          progress,
          budget,
          estimated_cost,
          actual_cost,
          estimated_profit,
          actual_profit,
          start_date,
          due_date
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
        )
        RETURNING *
        `,
        [
          body.business_id || null,
          body.customer_id || null,
          name,
          text(body.description) || null,
          text(body.location) || null,
          text(body.status) || "planning",
          progress,
          number(body.budget),
          number(body.estimated_cost),
          number(body.actual_cost),
          number(body.estimated_profit),
          number(body.actual_profit),
          body.start_date || null,
          body.due_date || null
        ]
      );

      res.status(201).json(result.rows[0]);
    })
  );

  // VER UNA OBRA
  app.get(
    "/api/construction/projects/:id",
    requireAuth,
    asyncRoute(async (req, res) => {
      const project = await query(
        `
        SELECT
          cp.*,
          c.name AS customer_name,
          b.name AS business_name
        FROM construction_projects cp
        LEFT JOIN customers c ON c.id = cp.customer_id
        LEFT JOIN businesses b ON b.id = cp.business_id
        WHERE cp.id = $1
        `,
        [req.params.id]
      );

      if (!project.rows.length) {
        return res.status(404).json({
          error: "Obra no encontrada."
        });
      }

      const [
        materials,
        labor,
        expenses,
        tasks,
        updates
      ] = await Promise.all([
        query(
          `
          SELECT *
          FROM construction_materials
          WHERE project_id = $1
          ORDER BY created_at DESC
          `,
          [req.params.id]
        ),

        query(
          `
          SELECT *
          FROM construction_labor
          WHERE project_id = $1
          ORDER BY created_at DESC
          `,
          [req.params.id]
        ),

        query(
          `
          SELECT *
          FROM construction_expenses
          WHERE project_id = $1
          ORDER BY expense_date DESC, created_at DESC
          `,
          [req.params.id]
        ),

        query(
          `
          SELECT *
          FROM construction_tasks
          WHERE project_id = $1
          ORDER BY created_at DESC
          `,
          [req.params.id]
        ),

        query(
          `
          SELECT *
          FROM construction_updates
          WHERE project_id = $1
          ORDER BY created_at DESC
          `,
          [req.params.id]
        )
      ]);

      res.json({
        ...project.rows[0],
        materials: materials.rows,
        labor: labor.rows,
        expenses: expenses.rows,
        tasks: tasks.rows,
        updates: updates.rows
      });
    })
  );

  // ACTUALIZAR OBRA
  app.patch(
    "/api/construction/projects/:id",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};

      const progress =
        body.progress === undefined ||
        body.progress === null
          ? null
          : Math.min(
              100,
              Math.max(0, number(body.progress))
            );

      const result = await query(
        `
        UPDATE construction_projects
        SET
          name = COALESCE(NULLIF($1,''), name),
          description = COALESCE($2, description),
          location = COALESCE($3, location),
          status = COALESCE(NULLIF($4,''), status),
          progress = COALESCE($5, progress),
          budget = COALESCE($6, budget),
          estimated_cost = COALESCE($7, estimated_cost),
          actual_cost = COALESCE($8, actual_cost),
          estimated_profit = COALESCE($9, estimated_profit),
          actual_profit = COALESCE($10, actual_profit),
          start_date = COALESCE($11, start_date),
          due_date = COALESCE($12, due_date),
          updated_at = NOW()
        WHERE id = $13
        RETURNING *
        `,
        [
          text(body.name),
          body.description ?? null,
          body.location ?? null,
          text(body.status),
          progress,
          body.budget == null ? null : number(body.budget),
          body.estimated_cost == null
            ? null
            : number(body.estimated_cost),
          body.actual_cost == null
            ? null
            : number(body.actual_cost),
          body.estimated_profit == null
            ? null
            : number(body.estimated_profit),
          body.actual_profit == null
            ? null
            : number(body.actual_profit),
          body.start_date ?? null,
          body.due_date ?? null,
          req.params.id
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: "Obra no encontrada."
        });
      }

      res.json(result.rows[0]);
    })
  );

  // AGREGAR MATERIAL
  app.post(
    "/api/construction/projects/:id/materials",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const name = text(body.name);

      if (!name) {
        return res.status(400).json({
          error: "El nombre del material es obligatorio."
        });
      }

      const result = await query(
        `
        INSERT INTO construction_materials (
          project_id,
          name,
          unit,
          quantity,
          unit_cost,
          purchased_quantity,
          used_quantity,
          supplier,
          notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
          req.params.id,
          name,
          text(body.unit) || "unidad",
          number(body.quantity),
          number(body.unit_cost),
          number(body.purchased_quantity),
          number(body.used_quantity),
          text(body.supplier) || null,
          text(body.notes) || null
        ]
      );

      res.status(201).json(result.rows[0]);
    })
  );

  // AGREGAR MANO DE OBRA
  app.post(
    "/api/construction/projects/:id/labor",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const worker = text(body.worker_name);

      if (!worker) {
        return res.status(400).json({
          error: "El nombre del trabajador es obligatorio."
        });
      }

      const days = number(body.days);
      const dailyRate = number(body.daily_rate);
      const totalCost =
        body.total_cost == null
          ? days * dailyRate
          : number(body.total_cost);

      const result = await query(
        `
        INSERT INTO construction_labor (
          project_id,
          worker_name,
          role,
          days,
          daily_rate,
          total_cost,
          notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          req.params.id,
          worker,
          text(body.role) || null,
          days,
          dailyRate,
          totalCost,
          text(body.notes) || null
        ]
      );

      res.status(201).json(result.rows[0]);
    })
  );

  // AGREGAR GASTO
  app.post(
    "/api/construction/projects/:id/expenses",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const description = text(body.description);

      if (!description) {
        return res.status(400).json({
          error: "La descripción del gasto es obligatoria."
        });
      }

      const result = await query(
        `
        INSERT INTO construction_expenses (
          project_id,
          category,
          description,
          amount,
          expense_date
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          COALESCE($5::date, CURRENT_DATE)
        )
        RETURNING *
        `,
        [
          req.params.id,
          text(body.category) || "general",
          description,
          number(body.amount),
          body.expense_date || null
        ]
      );

      res.status(201).json(result.rows[0]);
    })
  );

  // AGREGAR TAREA
  app.post(
    "/api/construction/projects/:id/tasks",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};
      const name = text(body.name);

      if (!name) {
        return res.status(400).json({
          error: "El nombre de la tarea es obligatorio."
        });
      }

      const progress = Math.min(
        100,
        Math.max(0, number(body.progress))
      );

      const result = await query(
        `
        INSERT INTO construction_tasks (
          project_id,
          name,
          status,
          progress,
          start_date,
          due_date,
          responsible,
          notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          req.params.id,
          name,
          text(body.status) || "pending",
          progress,
          body.start_date || null,
          body.due_date || null,
          text(body.responsible) || null,
          text(body.notes) || null
        ]
      );

      res.status(201).json(result.rows[0]);
    })
  );

  // ACTUALIZAR TAREA
  app.patch(
    "/api/construction/tasks/:id",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};

      const progress =
        body.progress == null
          ? null
          : Math.min(
              100,
              Math.max(0, number(body.progress))
            );

      const result = await query(
        `
        UPDATE construction_tasks
        SET
          name = COALESCE(NULLIF($1,''), name),
          status = COALESCE(NULLIF($2,''), status),
          progress = COALESCE($3, progress),
          start_date = COALESCE($4, start_date),
          due_date = COALESCE($5, due_date),
          responsible = COALESCE($6, responsible),
          notes = COALESCE($7, notes)
        WHERE id = $8
        RETURNING *
        `,
        [
          text(body.name),
          text(body.status),
          progress,
          body.start_date ?? null,
          body.due_date ?? null,
          body.responsible ?? null,
          body.notes ?? null,
          req.params.id
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: "Tarea no encontrada."
        });
      }

      res.json(result.rows[0]);
    })
  );

  // REGISTRAR AVANCE
  app.post(
    "/api/construction/projects/:id/updates",
    requireAuth,
    asyncRoute(async (req, res) => {
      const body = req.body || {};

      const progress =
        body.progress == null
          ? null
          : Math.min(
              100,
              Math.max(0, number(body.progress))
            );

      const result = await query(
        `
        INSERT INTO construction_updates (
          project_id,
          progress,
          note,
          photo_url
        )
        VALUES ($1,$2,$3,$4)
        RETURNING *
        `,
        [
          req.params.id,
          progress,
          text(body.note) || null,
          text(body.photo_url) || null
        ]
      );

      if (progress !== null) {
        await query(
          `
          UPDATE construction_projects
          SET
            progress = $1,
            status = CASE
              WHEN $1 >= 100 THEN 'completed'
              WHEN $1 > 0 THEN 'in_progress'
              ELSE status
            END,
            updated_at = NOW()
          WHERE id = $2
          `,
          [progress, req.params.id]
        );
      }

      res.status(201).json(result.rows[0]);
    })
  );

  // RESUMEN