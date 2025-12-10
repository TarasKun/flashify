import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  authBootstrapRequestSchema,
  authBootstrapResponseSchema,
  type AuthBootstrapResponse,
} from "@flashify/contracts";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthenticatedPrincipal } from "./authenticated-principal.js";
import { AuthBootstrapService } from "./auth-bootstrap.service.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

@Controller("v1/auth")
@UseGuards(SupabaseAuthGuard)
export class AuthBootstrapController {
  constructor(private readonly authBootstrapService: AuthBootstrapService) {}

  @Post("bootstrap")
  async bootstrap(
    @Body() body: unknown,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ): Promise<AuthBootstrapResponse> {
    const parsedRequest = authBootstrapRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "The bootstrap request is invalid.",
      });
    }

    const response = await this.authBootstrapService.bootstrap(
      principal,
      parsedRequest.data,
    );

    return authBootstrapResponseSchema.parse(response);
  }
}
