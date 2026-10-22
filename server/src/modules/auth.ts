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
  DeviceConnection,
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
  phoneUnlock = false,
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
      expiresIn: phoneUnlock ? "3650d" : "30d",
      issuer: "tamiltrade",
      audience: "tamiltrade-refresh",
      algorithm: "HS256",
    },
  );
  return {
    accessToken: access,
    refreshToken: refresh,
    user: publicUser(user),
    phoneUnlock,
  };
}
const sessionExpiry = (phoneUnlock: boolean) =>
  new Date(Date.now() + (phoneUnlock ? 3650 : 30) * 86400000);
async function createSession(
  user: UserDoc & { _id: mongoose.Types.ObjectId },
  device: string,
  phoneUnlock = false,
  transaction?: mongoose.ClientSession,
) {
  const sessionId = new mongoose.Types.ObjectId();
  const result = tokens(user, String(sessionId), phoneUnlock);
  await Session.create(
    [
      {
        _id: sessionId,
        businessId: user.businessId,
        userId: user._id,
        tokenHash: hashToken(result.refreshToken),
        expiresAt: sessionExpiry(phoneUnlock),
        device,
        phoneUnlock,
      },
    ],
    { session: transaction },
  );
  return result;
}
// A device unlock result never establishes server identity by itself.
export async function issueConnectionCode(
  user: UserDoc & { _id: mongoose.Types.ObjectId },
  issuerSessionId?: string,
) {
  const code = randomBytes(16).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60000);
  await DeviceConnection.create({
    businessId: user.businessId,
    userId: user._id,
    issuerSessionId,
    hash: hashToken(code),
    expiresAt,
  });
  await Audit.create({
    businessId: user.businessId,
    userId: user._id,
    action: "DEVICE_CONNECTION_CODE_CREATED",
    entityId: user._id,
  });
  return { code: code.match(/.{4}/g)!.join("-"), expiresAt };
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
authRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
authRouter.post("/phone/connect", async (req, res) => {
  const { code, device } = z
    .object({
      code: z
        .string()
        .max(80)
        .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
        .pipe(
          z.string().regex(/^[A-F\d]{32}$/, "Enter the full connection code"),
        ),
      device: z.string().trim().min(1).max(100).default("Phone"),
    })
    .strict()
    .parse(req.body);
  const result = await mongoose.connection.transaction(async (session) => {
    const connection = await DeviceConnection.findOneAndDelete(
      {
        hash: hashToken(code),
        expiresAt: { $gt: new Date() },
      },
      { session },
    );
    assert(
      connection,
      401,
      "CONNECTION_INVALID",
      "Connection code is invalid, expired or already used. Ask for a new code.",
    );
    if (connection.issuerSessionId) {
      const issuer = await Session.exists({
        _id: connection.issuerSessionId,
        userId: connection.userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).session(session);
      assert(
        issuer,
        401,
        "CONNECTION_INVALID",
        "This connection is no longer available. Ask for a new code.",
      );
    }
    const user = await User.findOne({
      _id: connection.userId,
      businessId: connection.businessId,
      active: true,
    }).session(session);
    assert(
      user,
      401,
      "CONNECTION_INVALID",
      "This connection is no longer available. Ask the business owner for help.",
    );
    const credentials = await createSession(user, device, true, session);
    await Audit.create(
      [
        {
          businessId: user.businessId,
          userId: user._id,
          action: "PHONE_CONNECTED",
          entityId: user._id,
        },
      ],
      { session },
    );
    return credentials;
  });
  res.status(201).json(result);
});
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
  const currentSession = await Session.findOne({
    _id: claims.sid,
    userId: user._id,
  }).lean();
  const phoneUnlock = currentSession?.phoneUnlock === true;
  const result = tokens(user, claims.sid, phoneUnlock);
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
        expiresAt: sessionExpiry(phoneUnlock),
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
    await DeviceConnection.deleteMany({ userId: recovery.userId }, { session });
  });
  res.json({ message: "Password updated. Please sign in." });
});
authRouter.use(authenticate);
authRouter.post("/phone/connection-code", async (req, res) => {
  res
    .status(201)
    .json(
      await issueConnectionCode(
        (await User.findById(req.auth.userId))!,
        req.auth.sessionId,
      ),
    );
});
authRouter.post("/phone/trust", async (req, res) => {
  const user = (await User.findById(req.auth.userId))!;
  const result = tokens(user, req.auth.sessionId, true);
  const session = await Session.findOneAndUpdate(
    {
      _id: req.auth.sessionId,
      userId: user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        phoneUnlock: true,
        tokenHash: hashToken(result.refreshToken),
        expiresAt: sessionExpiry(true),
      },
    },
  );
  assert(
    session,
    401,
    "SESSION_EXPIRED",
    "Connect this phone again using a new connection code.",
  );
  res.json(result);
});
authRouter.get("/me", async (req, res) => {
  res.json(publicUser((await User.findById(req.auth.userId))!));
});
authRouter.post("/logout", async (req, res) => {
  await Session.updateOne(
    { _id: req.auth.sessionId },
    { $set: { revokedAt: new Date() } },
  );
  await DeviceConnection.deleteMany({
    userId: req.auth.userId,
    issuerSessionId: req.auth.sessionId,
  });
  res.sendStatus(204);
});
authRouter.get("/sessions", async (req, res) => {
  const sessions = await Session.find({
    userId: req.auth.userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select("device phoneUnlock createdAt expiresAt")
    .lean();
  res.json(
    sessions.map((session) => ({
      ...session,
      current: String(session._id) === req.auth.sessionId,
    })),
  );
});
authRouter.delete("/sessions/:id", async (req, res) => {
  const id = z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .parse(req.params.id);
  await Session.updateOne(
    {
      _id: id,
      userId: req.auth.userId,
    },
    { $set: { revokedAt: new Date() } },
  );
  await DeviceConnection.deleteMany({
    userId: req.auth.userId,
    issuerSessionId: id,
  });
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
    await DeviceConnection.deleteMany({ userId }, { session });
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
