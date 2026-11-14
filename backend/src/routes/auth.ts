
import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";

const router = Router();

// POST /api/auth/initialize-admin
router.post("/initialize-admin", async (req, res) => {
  const setupKey = req.get("x-initial-admin-key");
  const expectedKey = process.env.INITIAL_ADMIN_SETUP_KEY;

  const suppliedKeyBuffer = Buffer.from(setupKey ?? "");
  const expectedKeyBuffer = Buffer.from(expectedKey ?? "");

  if (
    !setupKey ||
    !expectedKey ||
    suppliedKeyBuffer.length !== expectedKeyBuffer.length ||
    !timingSafeEqual(suppliedKeyBuffer, expectedKeyBuffer)
  ) {
    res.status(403).json({ message: "Invalid initialization key" });
    return;
  }

  const { username, password, fullName, email } = req.body;

  if (
    typeof username !== "string" ||
    !/^[a-zA-Z0-9._-]{3,50}$/.test(username.trim()) ||
    typeof password !== "string" ||
    password.length < 12 ||
    typeof fullName !== "string" ||
    !fullName.trim() ||
    (email !== undefined &&
      email !== null &&
      typeof email !== "string")
  ) {
    res.status(400).json({
      message: "Invalid administrator data. Password must contain at least 12 characters.",
    });
    return;
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    await client.query("SELECT pg_advisory_xact_lock(8142026)");

    const usersResult = await client.query(
      "SELECT COUNT(*)::integer AS total FROM users"
    );

    if (usersResult.rows[0].total > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      res.status(409).json({
        message: "Administrator initialization is already completed",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await client.query(
      `INSERT INTO users (
        username,
        password_hash,
        full_name,
        email,
        role,
        is_active
      )
      VALUES ($1, $2, $3, $4, 'Admin', TRUE)
      RETURNING id, username, full_name AS "fullName", role`,
      [
        username.trim(),
        passwordHash,
        fullName.trim(),
        typeof email === "string" && email.trim()
          ? email.trim()
          : null,
      ]
    );

    await client.query(
      `INSERT INTO audit_trail (
        username,
        action,
        entity_type,
        record_id,
        details
      )
      VALUES ($1, 'CREATE', 'USER', $2, 'Initial administrator created')`,
      [username.trim(), String(result.rows[0].id)]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({
      message: "Initial administrator created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Administrator initialization error:", error);

    res.status(500).json({
      message: "Failed to initialize administrator",
    });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password
  ) {
    res.status(400).json({
      status: "error",
      message: "Username and password are required",
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
        id,
        username,
        full_name AS "fullName",
        password_hash AS "passwordHash",
        role,
        is_active AS "isActive"
      FROM users
      WHERE username = $1
      LIMIT 1`,
      [username.trim()]
    );

    const user = result.rows[0];

    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      res.status(401).json({
        status: "error",
        message: "Invalid username or password",
      });
      return;
    }

    if (user.role !== "Admin" && user.role !== "Chemist") {
      res.status(403).json({
        status: "error",
        message: "User role is not permitted",
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    req.session.user = {
      id: String(user.id),
      username: user.username,
      fullName: user.fullName,
      role: user.role as "Admin" | "Chemist",
    };

    await pool.query(
      "UPDATE users SET last_login = NOW() WHERE id = $1",
      [user.id]
    );

    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    res.status(200).json({
      status: "ok",
      message: "Login successful",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to complete login",
    });
  }
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session.user) {
    res.status(401).json({
      status: "error",
      message: "Not authenticated",
    });
    return;
  }

  res.status(200).json({
    status: "ok",
    user: req.session.user,
  });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      res.status(500).json({
        status: "error",
        message: "Unable to log out",
      });
      return;
    }

    res.clearCookie("labinventory.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      status: "ok",
      message: "Logout successful",
    });
  });
});

export default router;
