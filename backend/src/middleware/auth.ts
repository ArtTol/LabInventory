
import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.user) {
    res.status(401).json({
      status: "error",
      message: "Authentication required",
    });
    return;
  }

  next();
};

export const requireRole = (
  ...allowedRoles: Array<"Admin" | "Chemist">
): RequestHandler => {
  return (req, res, next) => {
    if (!req.session.user) {
      res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
};
