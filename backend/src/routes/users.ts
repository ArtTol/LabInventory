
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/users
router.get("/", requireRole("Admin"), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        username,
        full_name AS "fullName",
        email,
        role,
        is_active AS "isActive",
        last_login AS "lastLogin",
        created_at AS "createdAt"
      FROM users
      ORDER BY id
    `);

    res.status(200).json({
      status: "ok",
      data: result.rows,
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to retrieve users",
    });
  }
});

// POST /api/users
router.post("/", requireRole("Admin"), async (req, res) => {
  const { username, password, fullName, email, role } = req.body;

  if (
    typeof username !== "string" ||
    !/^[a-zA-Z0-9._-]{3,50}$/.test(username.trim()) ||
    typeof password !== "string" ||
    password.length < 12 ||
    typeof fullName !== "string" ||
    !fullName.trim() ||
    (email !== undefined &&
      email !== null &&
      typeof email !== "string") ||
    !["Admin", "Chemist"].includes(role)
  ) {
    res.status(400).json({
      status: "error",
      message: "Invalid user data. Password must contain at least 12 characters.",
    });
    return;
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

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
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING
        id,
        username,
        full_name AS "fullName",
        email,
        role,
        is_active AS "isActive",
        created_at AS "createdAt"`,
      [
        username.trim(),
        passwordHash,
        fullName.trim(),
        typeof email === "string" && email.trim()
          ? email.trim()
          : null,
        role,
      ]
    );

    const newUser = result.rows[0];

    await client.query(
      `INSERT INTO audit_trail (
        user_id,
        username,
        action,
        entity_type,
        record_id,
        details
      )
      VALUES ($1, $2, 'CREATE', 'USER', $3, $4)`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        String(newUser.id),
        `Created user ${newUser.username}; role: ${newUser.role}`,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      status: "ok",
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Create user rollback error:", rollbackError);
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        status: "error",
        message: "Username or email already exists",
      });
      return;
    }

    console.error("Create user error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to create user",
    });
  } finally {
    client?.release();
  }
});

// PUT /api/users/:id
router.put("/:id", requireRole("Admin"), async (req, res) => {
  const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;
  const { username, fullName, email, role } = req.body;

  if (
    !/^[1-9]\d*$/.test(id) ||
    typeof username !== "string" ||
    !/^[a-zA-Z0-9._-]{3,50}$/.test(username.trim()) ||
    typeof fullName !== "string" ||
    !fullName.trim() ||
    (email !== undefined &&
      email !== null &&
      typeof email !== "string") ||
    !["Admin", "Chemist"].includes(role)
  ) {
    res.status(400).json({
      status: "error",
      message: "Invalid user data",
    });
    return;
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE users
       SET
         username = $1,
         full_name = $2,
         email = $3,
         role = $4
       WHERE id = $5
       RETURNING
         id,
         username,
         full_name AS "fullName",
         email,
         role,
         is_active AS "isActive",
         last_login AS "lastLogin",
         created_at AS "createdAt"`,
      [
        username.trim(),
        fullName.trim(),
        typeof email === "string" && email.trim()
          ? email.trim()
          : null,
        role,
        id,
      ]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");

      res.status(404).json({
        status: "error",
        message: "User not found",
      });
      return;
    }

    const updatedUser = result.rows[0];

    await client.query(
      `INSERT INTO audit_trail (
        user_id,
        username,
        action,
        entity_type,
        record_id,
        details
      )
      VALUES ($1, $2, 'UPDATE', 'USER', $3, $4)`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        String(updatedUser.id),
        `Updated user ${updatedUser.username}; role: ${updatedUser.role}`,
      ]
    );

    await client.query("COMMIT");

    res.status(200).json({
      status: "ok",
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Update user rollback error:", rollbackError);
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        status: "error",
        message: "Username or email already exists",
      });
      return;
    }

    console.error("Update user error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to update user",
    });
  } finally {
    client?.release();
  }
});

// PATCH /api/users/:id/status
router.patch("/:id/status", requireRole("Admin"), async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  const { isActive } = req.body;

  if (!/^[1-9]\d*$/.test(id) || typeof isActive !== "boolean") {
    res.status(400).json({
      status: "error",
      message: "Invalid user ID or status",
    });
    return;
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Serialize user status changes to protect the last active Admin.
    await client.query(
      "LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE"
    );

    const userResult = await client.query(
      `SELECT id, username, role, is_active AS "isActive"
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");

      res.status(404).json({
        status: "error",
        message: "User not found",
      });
      return;
    }

    const targetUser = userResult.rows[0];

    if (
      targetUser.role === "Admin" &&
      targetUser.isActive &&
      !isActive
    ) {
      const adminResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM users
         WHERE role = 'Admin' AND is_active = TRUE`
      );

      if (adminResult.rows[0].count <= 1) {
        await client.query("ROLLBACK");

        res.status(400).json({
          status: "error",
          message: "At least one active administrator must remain",
        });
        return;
      }
    }

    if (targetUser.isActive === isActive) {
      await client.query("COMMIT");

      res.status(200).json({
        status: "ok",
        message: "User status is already up to date",
        data: {
          id: targetUser.id,
          username: targetUser.username,
          isActive: targetUser.isActive,
        },
      });
      return;
    }

    const result = await client.query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2
       RETURNING
         id,
         username,
         full_name AS "fullName",
         email,
         role,
         is_active AS "isActive"`,
      [isActive, id]
    );

    const updatedUser = result.rows[0];

    await client.query(
      `INSERT INTO audit_trail (
        user_id,
        username,
        action,
        entity_type,
        record_id,
        details
      )
      VALUES ($1, $2, $3, 'USER', $4, $5)`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        isActive ? "ACTIVATE" : "DEACTIVATE",
        String(updatedUser.id),
        `${isActive ? "Activated" : "Deactivated"} user ${updatedUser.username}`,
      ]
    );

    await client.query("COMMIT");

    res.status(200).json({
      status: "ok",
      message: "User status updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Update user status rollback error:", rollbackError);
      }
    }

    console.error("Update user status error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to update user status",
    });
  } finally {
    client?.release();
  }
});
// PATCH /api/users/:id/password
router.patch("/:id/password", requireRole("Admin"), async (req, res) => {
  const id = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  const { password } = req.body;

  if (
    !/^[1-9]\d*$/.test(id) ||
    typeof password !== "string" ||
    password.length < 12
  ) {
    res.status(400).json({
      status: "error",
      message: "Invalid user ID or password. Password must contain at least 12 characters.",
    });
    return;
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id, username`,
      [passwordHash, id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");

      res.status(404).json({
        status: "error",
        message: "User not found",
      });
      return;
    }

    const updatedUser = result.rows[0];

    await client.query(
      `INSERT INTO audit_trail (
        user_id,
        username,
        action,
        entity_type,
        record_id,
        details
      )
      VALUES ($1, $2, 'PASSWORD_RESET', 'USER', $3, $4)`,
      [
        req.session.user?.id ?? null,
        req.session.user?.username ?? null,
        String(updatedUser.id),
        `Password reset for user ${updatedUser.username}`,
      ]
    );

    await client.query("COMMIT");

    res.status(200).json({
      status: "ok",
      message: "User password updated successfully",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Password reset rollback error:", rollbackError);
      }
    }

    console.error("Password reset error:", error);

    res.status(500).json({
      status: "error",
      message: "Unable to reset user password",
    });
  } finally {
    client?.release();
  }
});

export default router;
