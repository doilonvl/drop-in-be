import { NextFunction, Response, Request } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { userRepo } from "../repositories/user.repo";

export interface AuthAdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authAdmin(
  req: AuthAdminRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    const cookieToken = (req.cookies && req.cookies.access_token) || null;
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await userRepo.getById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    req.adminUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (err) {
    console.error("authAdmin error", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
}
