
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";

const router = Router();

const isProduction =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.RAILWAY_ENVIRONMENT);

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
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });

    res.status(200).json({
      status: "ok",
      message: "Logout successful",
    });
  });
});

export default router;

