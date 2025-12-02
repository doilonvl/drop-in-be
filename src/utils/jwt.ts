// src/utils/jwt.ts
import jwt from "jsonwebtoken";
import type { Response } from "express";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_dev";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_dev";

const ACCESS_EXPIRES = process.env.JWT_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES || "7d";

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || "localhost";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

export interface JwtPayloadBase {
  sub: string; // user id
  role?: string;
}

// parse "15m", "7d", "1h" -> ms
function durationToMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2];
  const map: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (map[unit] || 1000);
}

const ACCESS_MAX_AGE_MS = durationToMs(ACCESS_EXPIRES, 15 * 60 * 1000);
const REFRESH_MAX_AGE_MS = durationToMs(
  REFRESH_EXPIRES,
  7 * 24 * 60 * 60 * 1000
);

export function signAccessToken(
  payload: Omit<JwtPayloadBase, "sub"> & { sub: string }
): string {
  return jwt.sign(payload, ACCESS_SECRET as jwt.Secret, {
    expiresIn: ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(
  payload: Omit<JwtPayloadBase, "sub"> & { sub: string }
): string {
  return jwt.sign(payload, REFRESH_SECRET as jwt.Secret, {
    expiresIn: REFRESH_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): JwtPayloadBase | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayloadBase;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayloadBase | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as JwtPayloadBase;
  } catch {
    return null;
  }
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
) {
  const cookieCommon = {
    httpOnly: true as const,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    secure: COOKIE_SECURE,
    domain: COOKIE_DOMAIN,
  };

  res.cookie("access_token", accessToken, {
    ...cookieCommon,
    maxAge: ACCESS_MAX_AGE_MS,
  });

  res.cookie("refresh_token", refreshToken, {
    ...cookieCommon,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response) {
  const cookieCommon = {
    httpOnly: true as const,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    secure: COOKIE_SECURE,
    domain: COOKIE_DOMAIN,
  };

  res.clearCookie("access_token", cookieCommon);
  res.clearCookie("refresh_token", cookieCommon);
}
