-- NAVAIA | Módulo de Construcción
-- Migración ADITIVA: no reemplaza schema.sql ni elimina datos existentes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS construction_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  location TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','quoted','in_progress','paused','completed','cancelled')),
  progress NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100),
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  estimated_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  start_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS construction_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'unidad',
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  purchased_quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  used_quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  supplier VARCHAR(180),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS construction_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  worker_name VARCHAR(160) NOT NULL,
  role VARCHAR(100),
  days NUMERIC(10,2) NOT NULL DEFAULT 0,
  daily_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS construction_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS construction_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','blocked')),
  progress NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100),
  start_date DATE,
  due_date DATE,
  responsible VARCHAR(160),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS construction_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  progress NUMERIC(5,2),
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_construction_projects_business
  ON construction_projects(business_id);

CREATE INDEX IF NOT EXISTS idx_construction_projects_customer
  ON construction_projects(customer_id);

CREATE INDEX IF NOT EXISTS idx_construction_materials_project
  ON construction_materials(project_id);

CREATE INDEX IF NOT EXISTS idx_construction_labor_project
  ON construction_labor(project_id);

CREATE INDEX IF NOT EXISTS idx_construction_expenses_project
  ON construction_expenses(project_id);

CREATE INDEX IF NOT EXISTS idx_construction_tasks_project
  ON construction_tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_construction_updates_project
  ON construction_updates(project_id);