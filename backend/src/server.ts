
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./config/database.js";
import materialsRouter from "./routes/materials.js";
import lotsRouter from "./routes/lots.js";
import movementsRouter from "./routes/movements.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import { requireRole } from "./middleware/auth.js";

dotenv.config({ path: "backend/.env" });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is not configured");
}

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

const PgSession = connectPgSimple(session);

app.use(
  session({
    name: "labinventory.sid",
    store: new PgSession({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/materials", materialsRouter);
app.use("/api/lots", lotsRouter);
app.use("/api/movements", movementsRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

// API health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "LabInventory API is running",
    timestamp: new Date().toISOString(),
  });
});

// Database health check
app.get("/api/db-health", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS database_time, current_database() AS database_name"
    );

    res.status(200).json({
      status: "connected",
      message: "PostgreSQL connection successful",
      database: result.rows[0].database_name,
      time: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      status: "error",
      message: "PostgreSQL connection failed",
    });
  }
});

// Database tables check
app.get("/api/db-tables", requireRole("Admin"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    res.status(200).json({
      status: "ok",
      count: result.rows.length,
      tables: result.rows.map((row) => row.table_name),
    });
  } catch (error) {
    console.error("Database tables error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to retrieve database tables",
    });
  }
});

// Temporary users count inspection
app.get("/api/db-users-count", requireRole("Admin"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::integer AS total_users,
        COALESCE(
          json_agg(
            json_build_object(
              'id', id,
              'username', username,
              'fullName', full_name,
              'role', role,
              'isActive', is_active
            )
            ORDER BY id
          ),
          '[]'::json
        ) AS users
      FROM users
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Database users inspection error:", error);
    res.status(500).json({
      message: "Unable to inspect users",
    });
  }
});

// Temporary database schema inspection
app.get("/api/db-schema", requireRole("Admin"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        is_identity,
        identity_generation,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('movements', 'audit_trail', 'users')
      ORDER BY table_name, ordinal_position
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Database schema error:", error);
    res.status(500).json({
      message: "Unable to retrieve database schema",
    });
  }
});

app.get("/api/db-constraints", requireRole("Admin"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        conrelid::regclass AS table_name,
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid IN (
        'public.movements'::regclass,
        'public.lots'::regclass
      )
      ORDER BY conrelid::regclass::text, conname
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Database constraints error:", error);
    res.status(500).json({ message: "Unable to retrieve constraints" });
  }
});

// GET /api/audit-trail
app.get("/api/audit-trail", requireRole("Admin"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        event_datetime AS "eventDate",
        username,
        action,
        entity_type AS "entityType",
        record_id AS "recordId",
        field_name AS "fieldName",
        old_value AS "oldValue",
        new_value AS "newValue",
        details
      FROM audit_trail
      ORDER BY event_datetime DESC, id DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get audit trail error:", error);
    res.status(500).json({
      message: "Failed to retrieve audit trail",
    });
  }
});

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    name: "LabInventory API",
    version: "1.0.0",
  });
});

app.listen(PORT, () => {
  console.log(`LabInventory API running at http://localhost:${PORT}`);
});
