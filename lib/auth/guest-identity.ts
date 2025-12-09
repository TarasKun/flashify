export const GUEST_IDENTITY_STORAGE_KEY = "flashify.guestIdentity";

export type GuestIdentity = {
  createdAt: string;
  id: string;
  kind: "guest";
};

type CreateGuestIdentityInput = {
  createdAt: string;
  id: string;
};

export function createGuestIdentity({
  createdAt,
  id,
}: CreateGuestIdentityInput): GuestIdentity {
  return {
    createdAt,
    id,
    kind: "guest",
  };
}

export function parseGuestIdentity(value: string | null): GuestIdentity | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      !("kind" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.kind !== "guest"
    ) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
      kind: "guest",
    };
  } catch {
    return null;
  }
}
