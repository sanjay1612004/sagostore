import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Express } from "express";

let replica: MongoMemoryReplSet;
let app: Express;
let owner: string;
let other: string;
let ownerId: string;
let businessId: string;
type Linked = {
  accessToken: string;
  refreshToken: string;
  phoneUnlock: boolean;
  user: { id: string; businessId: string; role: string; permissions: string[] };
};
const auth = (token = owner) => ({ Authorization: `Bearer ${token}` });
const sessionId = (token: string) =>
  (jwt.decode(token) as jwt.JwtPayload).sid as string;
async function code(token = owner) {
  const response = await request(app)
    .post("/auth/phone/connection-code")
    .set(auth(token))
    .send({});
  expect(response.status).toBe(201);
  expect(response.headers["cache-control"]).toBe("no-store");
  return response.body.code as string;
}
async function connect(value: string) {
  return request(app)
    .post("/auth/phone/connect")
    .send({ code: value, device: "Test phone" });
}

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.24" },
  });
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGODB_URI: replica.getUri(),
    LOG_LEVEL: "silent",
    JWT_ACCESS_SECRET: "phone-test-access-".repeat(6),
    JWT_REFRESH_SECRET: "phone-test-refresh-".repeat(6),
    REGISTRATION_ENABLED: "true",
  });
  const models = await import("../src/modules/models.js");
  await models.connectDatabase(replica.getUri());
  await models.ensureIndexes();
  app = (await import("../src/app.js")).app;
  for (const email of ["phone-owner@example.com", "other-phone@example.com"]) {
    const response = await request(app).post("/auth/register").send({
      email,
      password: "Phone-test-password-123",
      name: "Phone Test",
      businessName: email,
    });
    expect(response.status).toBe(201);
    if (email.startsWith("phone-owner")) {
      owner = response.body.accessToken;
      ownerId = response.body.user.id;
      businessId = response.body.user.businessId;
    } else other = response.body.accessToken;
  }
}, 180000);
afterAll(async () => {
  vi.useRealTimers();
  await mongoose.disconnect();
  await replica?.stop();
}, 30000);

describe.sequential(
  "one-time phone connection and revocable phone sessions",
  () => {
    it("requires account authentication to issue codes or trust an existing session", async () => {
      expect(
        (await request(app).post("/auth/phone/connection-code").send({}))
          .status,
      ).toBe(401);
      expect(
        (await request(app).post("/auth/phone/trust").send({})).status,
      ).toBe(401);
      expect((await request(app).get("/api/dashboard")).status).toBe(401);
    });
    it("stores only a code hash and connects exactly the issuing business and account", async () => {
      const { DeviceConnection, Session } =
        await import("../src/modules/models.js");
      const { hashToken } = await import("../src/modules/auth.js");
      const value = await code();
      const stored = await DeviceConnection.findOne({
        hash: hashToken(value.replace(/-/g, "")),
      })
        .select("+hash")
        .lean();
      expect(stored).toBeTruthy();
      expect(stored!.hash).not.toContain(value.replace(/-/g, ""));
      expect(String(stored!.businessId)).toBe(businessId);
      const response = await connect(value.toLowerCase().replace(/-/g, " "));
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        phoneUnlock: true,
        user: { id: ownerId, businessId, role: "owner" },
      });
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(await DeviceConnection.findById(stored!._id)).toBeNull();
      const session = await Session.findById(
        sessionId(response.body.accessToken),
      ).select("+tokenHash");
      expect(session?.phoneUnlock).toBe(true);
      expect(session?.tokenHash).not.toBe(response.body.refreshToken);
      expect((await connect(value)).status).toBe(401);
    });
    it("allows only one concurrent redemption of a connection code", async () => {
      const value = await code();
      const responses = await Promise.all([connect(value), connect(value)]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 401]);
    });
    it("accepts a code provisioned by the trusted server administrator", async () => {
      const { User } = await import("../src/modules/models.js");
      const { issueConnectionCode } = await import("../src/modules/auth.js");
      const user = await User.findById(ownerId);
      const connection = await issueConnectionCode(user!);
      const linked = await connect(connection.code);
      expect(linked.status).toBe(201);
      expect(linked.body.user.id).toBe(ownerId);
    });
    it("rejects a pending code if its issuing device has since been revoked", async () => {
      const { Session } = await import("../src/modules/models.js");
      const linked = (await connect(await code())).body as Linked;
      const pending = await code(linked.accessToken);
      // Even if cleanup hasn't deleted the code yet, issuer revocation is checked.
      await Session.updateOne(
        { _id: sessionId(linked.accessToken) },
        { $set: { revokedAt: new Date() } },
      );
      expect((await connect(pending)).status).toBe(401);
    });
    it("rejects expired, incorrect and account-injecting codes without creating a session", async () => {
      const { DeviceConnection, Session } =
        await import("../src/modules/models.js");
      const { hashToken } = await import("../src/modules/auth.js");
      const expired = await code();
      await DeviceConnection.updateOne(
        { hash: hashToken(expired.replace(/-/g, "")) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
      const count = await Session.countDocuments();
      expect((await connect(expired)).status).toBe(401);
      expect((await connect("A".repeat(32))).status).toBe(401);
      expect((await connect("1234")).status).toBe(422);
      const value = await code();
      const injected = await request(app).post("/auth/phone/connect").send({
        code: value,
        businessId: new mongoose.Types.ObjectId().toHexString(),
        role: "owner",
      });
      expect(injected.status).toBe(422);
      expect(await Session.countDocuments()).toBe(count);
      expect((await connect(value)).status).toBe(201);
    });
    it("refreshes a connected phone after the old 30-day login expiry while keeping sessions revocable", async () => {
      const linked = (await connect(await code())).body as Linked;
      try {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(Date.now() + 45 * 86400000));
        const refreshed = await request(app)
          .post("/auth/refresh")
          .send({ refreshToken: linked.refreshToken });
        expect(refreshed.status).toBe(200);
        expect(refreshed.body.phoneUnlock).toBe(true);
        expect(refreshed.body.user.id).toBe(ownerId);
        expect(refreshed.body.refreshToken).not.toBe(linked.refreshToken);
        expect(
          (
            await request(app)
              .get("/auth/me")
              .set(auth(refreshed.body.accessToken))
          ).status,
        ).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });
    it("upgrades an existing signed-in phone without asking for the account password again", async () => {
      const login = await request(app).post("/auth/login").send({
        email: "phone-owner@example.com",
        password: "Phone-test-password-123",
      });
      expect(login.body.phoneUnlock).toBe(false);
      const trusted = await request(app)
        .post("/auth/phone/trust")
        .set(auth(login.body.accessToken))
        .send({});
      expect(trusted.status).toBe(200);
      expect(trusted.body.phoneUnlock).toBe(true);
      expect(trusted.body.user.id).toBe(ownerId);
      const claims = jwt.decode(trusted.body.refreshToken) as jwt.JwtPayload;
      expect(claims.exp! - claims.iat!).toBe(3650 * 86400);
      const refreshed = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: trusted.body.refreshToken });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.phoneUnlock).toBe(true);
    });
    it("scopes device lists and revocation to the signed-in user, and blocks refresh after disconnection", async () => {
      const linked = (await connect(await code())).body as Linked;
      const id = sessionId(linked.accessToken);
      const own = await request(app)
        .get("/auth/sessions")
        .set(auth(linked.accessToken));
      expect(own.body.find((s: { _id: string }) => s._id === id)).toMatchObject(
        { current: true, phoneUnlock: true },
      );
      const otherList = await request(app)
        .get("/auth/sessions")
        .set(auth(other));
      expect(otherList.body.some((s: { _id: string }) => s._id === id)).toBe(
        false,
      );
      await request(app).delete(`/auth/sessions/${id}`).set(auth(other));
      expect(
        (await request(app).get("/auth/me").set(auth(linked.accessToken)))
          .status,
      ).toBe(200);
      await request(app).delete(`/auth/sessions/${id}`).set(auth(owner));
      expect(
        (await request(app).get("/auth/me").set(auth(linked.accessToken)))
          .status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post("/auth/refresh")
            .send({ refreshToken: linked.refreshToken })
        ).status,
      ).toBe(401);
    });
    it("revokes phone access when signing out", async () => {
      const linked = (await connect(await code())).body as Linked;
      const pending = await code(linked.accessToken);
      expect(
        (
          await request(app)
            .post("/auth/logout")
            .set(auth(linked.accessToken))
            .send({})
        ).status,
      ).toBe(204);
      expect(
        (
          await request(app)
            .post("/auth/refresh")
            .send({ refreshToken: linked.refreshToken })
        ).status,
      ).toBe(401);
      expect((await connect(pending)).status).toBe(401);
    });
    it("preserves staff permissions and invalidates old phones/codes after an account change", async () => {
      const staff = await request(app).post("/auth/staff").set(auth()).send({
        name: "Phone Staff",
        email: "phone-staff@example.com",
        password: "Staff-test-password-123",
        permissions: [],
      });
      expect(staff.status).toBe(201);
      const login = await request(app).post("/auth/login").send({
        email: "phone-staff@example.com",
        password: "Staff-test-password-123",
      });
      const pending = await code(login.body.accessToken);
      const linked = (await connect(await code(login.body.accessToken)))
        .body as Linked;
      expect(linked.user).toMatchObject({
        role: "staff",
        permissions: [],
        businessId,
      });
      expect(
        (
          await request(app)
            .post("/auth/staff")
            .set(auth(linked.accessToken))
            .send({})
        ).status,
      ).toBe(403);
      const change = await request(app)
        .patch(`/auth/staff/${staff.body.id}`)
        .set(auth())
        .send({ active: false, permissions: [] });
      expect(change.status).toBe(204);
      expect(
        (await request(app).get("/auth/me").set(auth(linked.accessToken)))
          .status,
      ).toBe(401);
      expect((await connect(pending)).status).toBe(401);
      await request(app)
        .patch(`/auth/staff/${staff.body.id}`)
        .set(auth())
        .send({ active: true, permissions: [] });
      expect((await connect(pending)).status).toBe(401);
    });
    it("account recovery revokes linked phones and outstanding connection codes", async () => {
      const { User, Recovery } = await import("../src/modules/models.js");
      const { hashToken } = await import("../src/modules/auth.js");
      const linked = (await connect(await code(other))).body as Linked;
      const pending = await code(other);
      const user = await User.findById(linked.user.id);
      const recovery = randomBytes(32).toString("hex");
      await Recovery.create({
        userId: user!._id,
        hash: hashToken(recovery),
        expiresAt: new Date(Date.now() + 60000),
      });
      const response = await request(app)
        .post("/auth/recover")
        .send({ token: recovery, password: "Changed-password-123" });
      expect(response.status).toBe(200);
      expect(
        (await request(app).get("/auth/me").set(auth(linked.accessToken)))
          .status,
      ).toBe(401);
      expect((await connect(pending)).status).toBe(401);
    });
  },
);
