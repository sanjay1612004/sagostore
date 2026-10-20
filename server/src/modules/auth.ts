import { Router, type RequestHandler } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import {
  loginSchema,
  registerSchema,
  permissions,
  type Permission,
} from "@tamiltrade/shared";
import { env } from "../config/env.js";
import { AppError, assert } from "../shared/errors.js";
import {
  Business,
  User,
  Session,
  Recovery,
  Audit,
  type UserDoc,
} from "./models.js";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export type Principal = {
  userId: string;
  businessId: string;
  sessionId: string;
  role: "owner" | "staff";
  permissions: Permission[];
  name: string;
};
declare global {
  namespace Express {
    interface Request {
      auth: Principal;
    }
  }
}
const publicUser = (user: UserDoc & { _id: mongoose.Types.ObjectId }) => ({
  id: String(user._id),
  businessId: String(user.businessId),
  name: user.name,
  email: user.email,
  role: user.role,
  permissions: user.permissions,
});
function tokens(
  user: UserDoc & { _id: mongoose.Types.ObjectId },
  sessionId: string,
) {
  const access = jwt.sign(
    { bid: String(user.businessId), sid: sessionId },
    env.JWT_ACCESS_SECRET,
    {
      subject: String(user._id),
      expiresIn: "10m",
      issuer: "tamiltrade",
      audience: "tamiltrade-mobile",
      algorithm: "HS256",
    },
  );
  const refresh = jwt.sign(
    { sid: sessionId, jti: randomBytes(24).toString("hex") },
    env.JWT_REFRESH_SECRET,
    {
      subject: String(user._id),
      expiresIn: "30d",
      issuer: "tamiltrade",
      audience: "tamiltrade-refresh",
      algorithm: "HS256",
    },
  );
  return { accessToken: access, refreshToken: refresh, user: publicUser(user) };
}
async function createSession(
  user: UserDoc & { _id: mongoose.Types.ObjectId },
  device: string,
) {
  const sessionId = new mongoose.Types.ObjectId();
  const result = tokens(user, String(sessionId));
  await Session.create({
    _id: sessionId,
    businessId: user.businessId,
    userId: user._id,
    tokenHash: hashToken(result.refreshToken),
    expiresAt: new Date(Date.now() + 30 * 86400000),
    device,
  });
  return result;
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    assert(token, 401, "UNAUTHENTICATED", "Please sign in");
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "tamiltrade",
      audience: "tamiltrade-mobile",
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    assert(
      typeof claims.sub === "string" && mongoose.isValidObjectId(claims.sid),
      401,
      "UNAUTHENTICATED",
      "Session expired",
    );
    const [user, session] = await Promise.all([
      User.findById(claims.sub).lean(),
      Session.findOne({
        _id: claims.sid,
        userId: claims.sub,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).lean(),
    ]);
    assert(
      user?.active && session && String(user.businessId) === claims.bid,
      401,
      "SESSION_EXPIRED",
      "Session expired or revoked. Please sign in again",
    );
    req.auth = {
      userId: String(user._id),
      businessId: String(user.businessId),
      sessionId: String(session._id),
      role: user.role,
      permissions: user.permissions,
      name: user.name,
    };
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError(
            401,
            "SESSION_EXPIRED",
            "Session expired. Please sign in again",
          ),
    );
  }
};
export const authorize =
  (permission: Permission | "owner"): RequestHandler =>
  (req, _res, next) => {
    if (
      req.auth.role === "owner" ||
      (permission !== "owner" && req.auth.permissions.includes(permission))
    )
      next();
    else
      next(
        new AppError(
          403,
          "FORBIDDEN",
          "Your account does not have permission for this action",
        ),
      );
  };
export const authRouter = Router();
authRouter.post("/register", async (req, res) => {
  assert(
    env.REGISTRATION_ENABLED,
    403,
    "REGISTRATION_CLOSED",
    "Account setup is disabled. Contact the business owner",
  );
  const input = registerSchema.parse(req.body);
  const email = input.email.toLowerCase();
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
  const user = await mongoose.connection.transaction(async (session) => {
    const [business] = await Business.create(
      [{ name: input.businessName, type: input.businessType }],
      { session },
    );
    const [owner] = await User.create(
      [
        {
          businessId: business!._id,
          name: input.name,
          email,
          passwordHash,
          role: "owner",
          permissions: [...permissions],
        },
      ],
      { session },
    );
    return owner!;
  });
  res.status(201).json(await createSession(user, "Owner setup"));
});
let dummyHash: Promise<string> | undefined;
authRouter.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+passwordHash",
  );
  dummyHash ??= argon2.hash(randomBytes(32).toString("hex"), {
    type: argon2.argon2id,
  });
  const valid = await argon2.verify(
    user?.passwordHash ?? (await dummyHash),
    input.password,
  );
  assert(
    user?.active && valid,
    401,
    "INVALID_CREDENTIALS",
    "Invalid email or password",
  );
  res.json(
    await createSession(
      user,
      z
        .string()
        .max(100)
        .parse(req.body.device ?? "Mobile"),
    ),
  );
});
authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = z
    .object({ refreshToken: z.string().max(2000) })
    .parse(req.body);
  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET, {
      issuer: "tamiltrade",
      audience: "tamiltrade-refresh",
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "SESSION_EXPIRED", "Please sign in again");
  }
  const user = await User.findById(claims.sub);
  assert(
    user?.active && mongoose.isValidObjectId(claims.sid),
    401,
    "SESSION_EXPIRED",
    "Please sign in again",
  );
  const result = tokens(user, claims.sid);
  const session = await Session.findOneAndUpdate(
    {
      _id: claims.sid,
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        tokenHash: hashToken(result.refreshToken),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    },
  );
  if (!session) {
    await Session.updateOne(
      { _id: claims.sid, userId: user._id },
      { $set: { revokedAt: new Date() } },
    );
    throw new AppError(
      401,
      "TOKEN_REPLAY",
      "Session revoked. Please sign in again",
    );
  }
  res.json(result);
});
authRouter.post("/recover", async (req, res) => {
  const { token, password } = z
    .object({
      token: z.string().min(40).max(200),
      password: registerSchema.shape.password,
    })
    .parse(req.body);
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
  await mongoose.connection.transaction(async (session) => {
    const recovery = await Recovery.findOneAndDelete(
      { hash: hashToken(token), expiresAt: { $gt: new Date() } },
      { session },
    );
    assert(
      recovery,
      400,
      "RECOVERY_INVALID",
      "Recovery token is invalid or expired",
    );
    await User.updateOne(
      { _id: recovery.userId },
      { $set: { passwordHash } },
      { session },
    );
    await Session.updateMany(
      { userId: recovery.userId },
      { $set: { revokedAt: new Date() } },
      { session },
    );
  });
  res.json({ message: "Password updated. Please sign in." });
});
authRouter.use(authenticate);
authRouter.get("/me", async (req, res) => {
  res.json(publicUser((await User.findById(req.auth.userId))!));
});
authRouter.post("/logout", async (req, res) => {
  await Session.updateOne(
    { _id: req.auth.sessionId },
    { $set: { revokedAt: new Date() } },
  );
  res.sendStatus(204);
});
authRouter.get("/sessions", async (req, res) => {
  res.json(
    await Session.find({
      userId: req.auth.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("device createdAt expiresAt")
      .lean(),
  );
});
authRouter.delete("/sessions/:id", async (req, res) => {
  await Session.updateOne(
    {
      _id: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .parse(req.params.id),
      userId: req.auth.userId,
    },
    { $set: { revokedAt: new Date() } },
  );
  res.sendStatus(204);
});
authRouter.get("/staff", authorize("owner"), async (req, res) => {
  res.json(
    await User.find({ businessId: req.auth.businessId })
      .select("name email role permissions active")
      .lean(),
  );
});
authRouter.post("/staff", authorize("owner"), async (req, res) => {
  const input = z
    .object({
      name: z.string().min(2).max(100),
      email: z.email(),
      password: registerSchema.shape.password,
      permissions: z.array(z.enum(permissions)),
    })
    .parse(req.body);
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });
  const user = await User.create({
    ...input,
    email: input.email.toLowerCase(),
    passwordHash,
    businessId: req.auth.businessId,
    role: "staff",
  });
  await Audit.create({
    businessId: req.auth.businessId,
    userId: req.auth.userId,
    action: "STAFF_CREATED",
    entityId: user._id,
  });
  res.status(201).json(publicUser(user));
});
authRouter.patch("/staff/:id", authorize("owner"), async (req, res) => {
  const input = z
    .object({ permissions: z.array(z.enum(permissions)), active: z.boolean() })
    .parse(req.body);
  const userId = z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .parse(req.params.id);
  await mongoose.connection.transaction(async (session) => {
    const user = await User.findOneAndUpdate(
      { _id: userId, businessId: req.auth.businessId, role: "staff" },
      { $set: input },
      { session },
    );
    assert(user, 404, "NOT_FOUND", "Staff account not found");
    await Session.updateMany(
      { userId },
      { $set: { revokedAt: new Date() } },
      { session },
    );
    await Audit.create(
      [
        {
          businessId: req.auth.businessId,
          userId: req.auth.userId,
          action: "STAFF_UPDATED",
          entityId: userId,
          details: input,
        },
      ],
      { session },
    );
  });
  res.sendStatus(204);
});
