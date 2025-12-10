import { randomUUID } from "node:crypto";
import {
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { AuthBootstrapController } from "./auth-bootstrap.controller.js";
import { AuthBootstrapService } from "./auth-bootstrap.service.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";
import { PrismaService } from "../database/prisma.service.js";
import {
  JwksSupabaseTokenVerifier,
  SUPABASE_TOKEN_VERIFIER,
} from "./supabase-token-verifier.js";

const DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public";
const SUPABASE_URL = "https://flashify-test.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;

describe("POST /v1/auth/bootstrap", () => {
  const prisma = new PrismaService(DATABASE_URL);
  const createdUserIds = new Set<string>();
  let app: INestApplication | undefined;

  afterEach(async () => {
    const userIds = [...createdUserIds];
    createdUserIds.clear();

    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await app?.close();
    app = undefined;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is idempotent and refreshes signed account and device details", async () => {
    const signer = await createTestSigner();
    const userId = randomUUID();
    const deviceId = randomUUID();
    createdUserIds.add(userId);
    app = await createApp(signer.verifier, prisma);

    const first = await bootstrap(app, await signer.sign(userId, {
      avatarUrl: "https://example.com/old-avatar.png",
      displayName: "First name",
    }), {
      deviceId,
      deviceName: "Taras's iPhone",
    });
    const second = await bootstrap(app, await signer.sign(userId, {
      avatarUrl: "https://example.com/new-avatar.png",
      displayName: "Updated name",
    }), {
      deviceId,
      deviceName: "Desktop browser",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    await expect(second.json()).resolves.toMatchObject({
      device: { id: deviceId, name: "Desktop browser" },
      user: {
        avatarUrl: "https://example.com/new-avatar.png",
        displayName: "Updated name",
        id: userId,
      },
    });
    await expect(prisma.user.count({ where: { id: userId } })).resolves.toBe(1);
    await expect(prisma.device.count({ where: { userId } })).resolves.toBe(1);
  });

  it("rejects a device ID owned by a different account", async () => {
    const signer = await createTestSigner();
    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    const deviceId = randomUUID();
    createdUserIds.add(firstUserId);
    createdUserIds.add(secondUserId);
    app = await createApp(signer.verifier, prisma);

    const first = await bootstrap(app, await signer.sign(firstUserId), { deviceId });
    const conflict = await bootstrap(app, await signer.sign(secondUserId), { deviceId });

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(403);
    await expect(conflict.json()).resolves.toMatchObject({
      code: "DEVICE_OWNERSHIP_CONFLICT",
      message: "This device belongs to a different account.",
    });
  });
});

async function bootstrap(
  app: INestApplication,
  accessToken: string,
  body: Record<string, string>,
): Promise<Response> {
  return fetch(`${await app.getUrl()}/v1/auth/bootstrap`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
}

async function createApp(
  verifier: JwksSupabaseTokenVerifier,
  prisma: PrismaService,
): Promise<INestApplication> {
  const moduleReference = await Test.createTestingModule({
    controllers: [AuthBootstrapController],
    providers: [
      AuthBootstrapService,
      SupabaseAuthGuard,
      { provide: PrismaService, useValue: prisma },
      { provide: SUPABASE_TOKEN_VERIFIER, useValue: verifier },
    ],
  }).compile();
  const testApp = moduleReference.createNestApplication();

  await testApp.listen(0);
  return testApp;
}

async function createTestSigner(): Promise<{
  verifier: JwksSupabaseTokenVerifier;
  sign: (
    userId: string,
    metadata?: { avatarUrl?: string; displayName?: string },
  ) => Promise<string>;
}> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const verificationKey = createLocalJWKSet({
    keys: [
      {
        ...publicJwk,
        alg: "RS256",
        kid: "test-signing-key",
        use: "sig",
      },
    ],
  });

  return {
    verifier: new JwksSupabaseTokenVerifier(SUPABASE_URL, verificationKey),
    sign: (
      userId: string,
      metadata: { avatarUrl?: string; displayName?: string } = {},
    ): Promise<string> =>
      new SignJWT({
        email: "learner@example.com",
        role: "authenticated",
        user_metadata: {
          avatar_url: metadata.avatarUrl,
          full_name: metadata.displayName,
        },
      })
        .setAudience("authenticated")
        .setExpirationTime("5 minutes")
        .setIssuedAt()
        .setIssuer(ISSUER)
        .setProtectedHeader({ alg: "RS256", kid: "test-signing-key" })
        .setSubject(userId)
        .sign(privateKey),
  };
}
