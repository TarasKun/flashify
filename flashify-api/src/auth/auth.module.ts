import { Module } from "@nestjs/common";
import { loadApiConfig } from "../config/api-config.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";
import {
  JwksSupabaseTokenVerifier,
  SUPABASE_TOKEN_VERIFIER,
} from "./supabase-token-verifier.js";

@Module({
  exports: [SupabaseAuthGuard, SUPABASE_TOKEN_VERIFIER],
  providers: [
    SupabaseAuthGuard,
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
