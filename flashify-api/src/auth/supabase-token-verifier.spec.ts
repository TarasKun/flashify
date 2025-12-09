import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { describe, expect, it } from "vitest";
import { JwksSupabaseTokenVerifier } from "./supabase-token-verifier.js";

const SUPABASE_URL = "https://flashify-test.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;

describe("JwksSupabaseTokenVerifier", () => {
  it("returns a typed principal from a valid Supabase access token", async () => {
    const signer = await createTestSigner();
    const verifier = new JwksSupabaseTokenVerifier(SUPABASE_URL, signer.keySet);

    await expect(verifier.verify(await signer.sign())).resolves.toEqual({
      email: "learner@example.com",
      userId: "user-123",
    });
  });

  it("rejects an expired token", async () => {
    const signer = await createTestSigner();
    const verifier = new JwksSupabaseTokenVerifier(SUPABASE_URL, signer.keySet);

    await expect(verifier.verify(await signer.sign("1 second ago"))).rejects.toThrow();
  });

  it("rejects a token from another Supabase project", async () => {
    const signer = await createTestSigner();
    const verifier = new JwksSupabaseTokenVerifier(SUPABASE_URL, signer.keySet);

    await expect(
      verifier.verify(await signer.sign("5 minutes", "https://other.supabase.co/auth/v1")),
    ).rejects.toThrow();
  });

  it("rejects a malformed token", async () => {
    const signer = await createTestSigner();
    const verifier = new JwksSupabaseTokenVerifier(SUPABASE_URL, signer.keySet);

    await expect(verifier.verify("not-a-jwt")).rejects.toThrow();
  });
});

async function createTestSigner(): Promise<{
  keySet: JWTVerifyGetKey;
  sign: (expirationTime?: string, issuer?: string) => Promise<string>;
}> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const keySet = createLocalJWKSet({
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
    keySet,
    sign: async (
      expirationTime = "5 minutes",
      issuer = ISSUER,
    ): Promise<string> =>
      new SignJWT({
        email: "learner@example.com",
        role: "authenticated",
      })
        .setAudience("authenticated")
        .setExpirationTime(expirationTime)
        .setIssuedAt()
        .setIssuer(issuer)
        .setProtectedHeader({ alg: "RS256", kid: "test-signing-key" })
        .setSubject("user-123")
        .sign(privateKey),
  };
}
