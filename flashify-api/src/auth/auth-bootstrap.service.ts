import { ForbiddenException, Injectable } from "@nestjs/common";
import type {
  AuthBootstrapRequest,
  AuthBootstrapResponse,
} from "@flashify/contracts";
import type { AuthenticatedPrincipal } from "./authenticated-principal.js";
import { PrismaService } from "../database/prisma.service.js";

const deviceOwnershipError = {
  code: "DEVICE_OWNERSHIP_CONFLICT",
  message: "This device belongs to a different account.",
};

@Injectable()
export class AuthBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(
    principal: AuthenticatedPrincipal,
    request: AuthBootstrapRequest,
  ): Promise<AuthBootstrapResponse> {
    const email = principal.email;

    if (email === null) {
      throw new ForbiddenException({
        code: "ACCOUNT_EMAIL_REQUIRED",
        message: "The authenticated account does not provide an email address.",
      });
    }

    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.upsert({
        create: {
          avatarUrl: principal.avatarUrl,
          displayName: principal.displayName,
          email,
          id: principal.userId,
          lastSeenAt: new Date(),
        },
        update: {
          avatarUrl: principal.avatarUrl,
          displayName: principal.displayName,
          email,
          lastSeenAt: new Date(),
        },
        where: { id: principal.userId },
      });

      const existingDevice = await transaction.device.findUnique({
        where: { id: request.deviceId },
      });

      if (existingDevice !== null && existingDevice.userId !== principal.userId) {
        throw new ForbiddenException(deviceOwnershipError);
      }

      const device =
        existingDevice === null
          ? await transaction.device.create({
              data: {
                id: request.deviceId,
                name: request.deviceName ?? null,
                userId: principal.userId,
              },
            })
          : await transaction.device.update({
              data: {
                lastSeenAt: new Date(),
                name: request.deviceName ?? null,
              },
              where: { id: existingDevice.id },
            });

      return {
        device: {
          id: device.id,
          name: device.name,
        },
        user: {
          avatarUrl: user.avatarUrl,
          displayName: user.displayName,
          email: user.email,
          id: user.id,
        },
      };
    });
  }
}
