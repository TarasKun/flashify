import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type {
  AuthenticatedPrincipal,
  AuthenticatedRequest,
} from "./authenticated-principal.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.principal === undefined) {
      throw new Error("CurrentUser requires SupabaseAuthGuard.");
    }

    return request.principal;
  },
);
