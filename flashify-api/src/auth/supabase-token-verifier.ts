import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import type { AuthenticatedPrincipal } from "./authenticated-principal.js";

const SUPABASE_AUDIENCE = "authenticated";
const JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1_000;
const JWKS_COOLDOWN_MS = 30 * 1_000;

export const SUPABASE_TOKEN_VERIFIER = Symbol("SUPABASE_TOKEN_VERIFIER");

export interface SupabaseTokenVerifier {
  verify(accessToken: string): Promise<AuthenticatedPrincipal>;
}

export class JwksSupabaseTokenVerifier implements SupabaseTokenVerifier {
  private readonly issuer: string;
  private readonly verificationKey: JWTVerifyGetKey;

  constructor(
    supabaseUrl: string,
    verificationKey: JWTVerifyGetKey = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
      {
        cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
        cooldownDuration: JWKS_COOLDOWN_MS,
      },
    ),
  ) {
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.verificationKey = verificationKey;
  }

  async verify(accessToken: string): Promise<AuthenticatedPrincipal> {
    const { payload } = await jwtVerify(accessToken, this.verificationKey, {
      audience: SUPABASE_AUDIENCE,
      issuer: this.issuer,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new Error("Supabase access token is missing a subject.");
    }

    return {
      avatarUrl: readUserMetadataValue(
        payload.user_metadata,
        "avatar_url",
        "picture",
      ),
      displayName: readUserMetadataValue(payload.user_metadata, "full_name", "name"),
      email: typeof payload.email === "string" ? payload.email : null,
      userId: payload.sub,
    };
  }
}

function readUserMetadataValue(
  metadata: unknown,
  ...keys: string[]
): string | null {
  if (typeof metadata !== "object" || metadata === null) {
    return null;
  }

  for (const key of keys) {
    const value = (metadata as Record<string, unknown>)[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
