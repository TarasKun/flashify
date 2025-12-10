import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { loadApiConfig } from "../config/api-config.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(databaseUrl = loadApiConfig(process.env).databaseUrl) {
    super({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
