import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "./authenticated-principal.js";
import {
  SUPABASE_TOKEN_VERIFIER,
  type SupabaseTokenVerifier,
} from "./supabase-token-verifier.js";

const unauthorizedResponse = {
  code: "UNAUTHORIZED",
  message: "A valid access token is required.",
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(SUPABASE_TOKEN_VERIFIER)
    private readonly tokenVerifier: SupabaseTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = readBearerToken(request.headers.authorization);

    if (accessToken === null) {
      throw new UnauthorizedException(unauthorizedResponse);
    }

    try {
      request.principal = await this.tokenVerifier.verify(accessToken);
      return true;
    } catch {
      throw new UnauthorizedException(unauthorizedResponse);
    }
  }
}

function readBearerToken(authorization: string | undefined): string | null {
  if (authorization === undefined) {
    return null;
  }

  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || token === undefined || extra.length > 0) {
    return null;
  }

  return token;
}
