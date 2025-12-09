import {
  Controller,
  Get,
  UseGuards,
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { afterEach, describe, expect, it } from "vitest";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthenticatedPrincipal } from "./authenticated-principal.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";
import {
  JwksSupabaseTokenVerifier,
  SUPABASE_TOKEN_VERIFIER,
} from "./supabase-token-verifier.js";

const SUPABASE_URL = "https://flashify-test.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;

@Controller("test/protected")
class ProtectedTestController {
  @Get()
  @UseGuards(SupabaseAuthGuard)
  getCurrentUser(@CurrentUser() principal: AuthenticatedPrincipal) {
    return principal;
  }
}

describe("SupabaseAuthGuard", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("allows a signed bearer token and exposes only the verified principal", async () => {
    const signer = await createTestSigner();
    app = await createApp(signer.verifier);

    const response = await fetch(`${await app.getUrl()}/test/protected`, {
      headers: { authorization: `Bearer ${await signer.sign()}` },
    });

    await expect(response.json()).resolves.toEqual({
      email: "learner@example.com",
      userId: "user-123",
    });
    expect(response.status).toBe(200);
  });

  it("returns a structured 401 when the bearer token is missing", async () => {
    const signer = await createTestSigner();
    app = await createApp(signer.verifier);

    const response = await fetch(`${await app.getUrl()}/test/protected`);
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "UNAUTHORIZED",
      message: "A valid access token is required.",
    });
  });

  it("returns the same 401 for an invalid token", async () => {
    const signer = await createTestSigner();
    app = await createApp(signer.verifier);

    const response = await fetch(`${await app.getUrl()}/test/protected`, {
      headers: { authorization: "Bearer invalid-token" },
    });
    const body = (await response.json()) as { code: string; message: string };

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "UNAUTHORIZED",
      message: "A valid access token is required.",
    });
  });
});

async function createApp(
  verifier: JwksSupabaseTokenVerifier,
): Promise<INestApplication> {
  const moduleReference = await Test.createTestingModule({
    controllers: [ProtectedTestController],
    providers: [
      SupabaseAuthGuard,
      {
        provide: SUPABASE_TOKEN_VERIFIER,
        useValue: verifier,
      },
    ],
  })
    .compile();
  const testApp = moduleReference.createNestApplication();

  await testApp.listen(0);
  return testApp;
}

async function createTestSigner(): Promise<{
  verifier: JwksSupabaseTokenVerifier;
  sign: () => Promise<string>;
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
    sign: (): Promise<string> =>
      new SignJWT({ email: "learner@example.com", role: "authenticated" })
        .setAudience("authenticated")
        .setExpirationTime("5 minutes")
        .setIssuedAt()
        .setIssuer(ISSUER)
        .setProtectedHeader({ alg: "RS256", kid: "test-signing-key" })
        .setSubject("user-123")
        .sign(privateKey),
  };
}
