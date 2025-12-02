import { Request, Response } from "express";
import { userRepo } from "../repositories/user.repo";
import { verifyPassword } from "../utils/password";
import {
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import type { AuthAdminRequest } from "../middlewares/authAdmin";

export const authController = {
  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as {
        email?: string;
        password?: string;
      };

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      const user = await userRepo.getByEmail(email);
      if (!user || user.provider !== "local") {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const ok = await verifyPassword(password, user.passwordHash || "");
      if (!ok) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res
          .status(403)
          .json({ message: "Account is inactive. Please contact admin." });
      }

      const payload = {
        sub: user.id,
        role: user.role,
      };

      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      setAuthCookies(res, accessToken, refreshToken);

      user.lastLoginAt = new Date();
      await user.save();

      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (err) {
      console.error("auth.login error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
  me: async (req: AuthAdminRequest, res: Response) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await userRepo.getById(req.adminUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch (err) {
      console.error("auth.me error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  logout: async (_req: Request, res: Response) => {
    try {
      clearAuthCookies(res);
      return res.json({ message: "Logged out" });
    } catch (err) {
      console.error("auth.logout error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  refresh: async (req: Request, res: Response) => {
    try {
      const tokenFromCookie =
        (req.cookies && req.cookies.refresh_token) || null;
      const tokenFromBody =
        (req.body && (req.body.refreshToken as string | undefined)) || null;

      const token = tokenFromCookie || tokenFromBody;

      if (!token) {
        return res.status(401).json({ message: "No refresh token" });
      }

      const payload = verifyRefreshToken(token);
      if (!payload?.sub) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      const user = await userRepo.getById(payload.sub);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "User not found or inactive" });
      }

      const newPayload = { sub: user.id, role: user.role };
      const accessToken = signAccessToken(newPayload);
      const refreshToken = signRefreshToken(newPayload);

      setAuthCookies(res, accessToken, refreshToken);

      return res.json({
        accessToken,
      });
    } catch (err) {
      console.error("auth.refresh error", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
