import { Module } from "@nestjs/common";
import { AuthBootstrapController } from "./auth-bootstrap.controller.js";
import { AuthBootstrapService } from "./auth-bootstrap.service.js";
import { loadApiConfig } from "../config/api-config.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";
import {
  JwksSupabaseTokenVerifier,
  SUPABASE_TOKEN_VERIFIER,
} from "./supabase-token-verifier.js";

@Module({
  controllers: [AuthBootstrapController],
  exports: [SupabaseAuthGuard, SUPABASE_TOKEN_VERIFIER],
  providers: [
    SupabaseAuthGuard,
    AuthBootstrapService,
    {
      provide: SUPABASE_TOKEN_VERIFIER,
      useFactory: () => {
        const config = loadApiConfig(process.env);
        return new JwksSupabaseTokenVerifier(config.supabaseUrl);
      },
    },
  ],
})
export class AuthModule {}
