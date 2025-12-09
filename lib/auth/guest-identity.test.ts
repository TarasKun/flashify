import { describe, expect, it } from "vitest";
import {
  createGuestIdentity,
  parseGuestIdentity,
  type GuestIdentity,
} from "./guest-identity";

describe("guest identity", () => {
  it("creates a persistent local-only identity", () => {
    const identity = createGuestIdentity({
      createdAt: "2026-07-17T15:00:00.000Z",
      id: "guest-1",
    });

    expect(identity).toEqual({
      createdAt: "2026-07-17T15:00:00.000Z",
      id: "guest-1",
      kind: "guest",
    });
  });

  it("restores only well-formed guest data", () => {
    const savedIdentity: GuestIdentity = {
      createdAt: "2026-07-17T15:00:00.000Z",
      id: "guest-1",
      kind: "guest",
    };

    expect(parseGuestIdentity(JSON.stringify(savedIdentity))).toEqual(
      savedIdentity,
    );
    expect(parseGuestIdentity('{"kind":"guest"}')).toBeNull();
    expect(parseGuestIdentity("not-json")).toBeNull();
  });
});
