import { Controller, Get } from "@nestjs/common";
import {
  healthResponseSchema,
  type HealthResponse,
} from "@flashify/contracts";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return healthResponseSchema.parse({
      service: "flashify-api",
      status: "ok",
    });
  }
}
