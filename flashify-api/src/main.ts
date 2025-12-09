import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadApiConfig } from "./config/api-config.js";

export async function bootstrap() {
  const config = loadApiConfig(process.env);
  const app = await NestFactory.create(AppModule);

  await app.listen(config.port);

  return app;
}

void bootstrap();
