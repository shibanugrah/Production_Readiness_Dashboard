import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionDelete: vi.fn(),
  sessionDeleteMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  })),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    session: {
      findUnique: mocks.sessionFindUnique,
      delete: mocks.sessionDelete,
      deleteMany: mocks.sessionDeleteMany,
    },
  },
}));

import {
  destroyCurrentSession,
  getCurrentSession,
  hashSessionToken,
  sessionCookieName,
} from "@/server/auth/session";

function validSession(token: string) {
  const now = new Date();

  return {
    id: "session_1",
    userId: "user_1",
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + 60_000),
    createdAt: now,
    updatedAt: now,
    user: {
      id: "user_1",
      name: "Demo Owner",
      email: "owner@example.local",
      passwordHash: "not-returned",
      createdAt: now,
      updatedAt: now,
    },
  };
}

describe("session lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthenticated safely when the session cookie is missing", async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mocks.sessionFindUnique).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("returns unauthenticated safely for a malformed session cookie", async () => {
    mocks.cookieGet.mockReturnValue({ name: sessionCookieName, value: "not a valid session token" });
    mocks.sessionFindUnique.mockResolvedValue(null);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mocks.sessionFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("not a valid session token") },
      include: { user: true },
    });
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.sessionDelete).not.toHaveBeenCalled();
  });

  it("returns unauthenticated safely for an unknown session token", async () => {
    mocks.cookieGet.mockReturnValue({ name: sessionCookieName, value: "unknown-token" });
    mocks.sessionFindUnique.mockResolvedValue(null);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.sessionDelete).not.toHaveBeenCalled();
  });

  it("returns unauthenticated safely for an expired session record", async () => {
    const token = "expired-token";
    mocks.cookieGet.mockReturnValue({ name: sessionCookieName, value: token });
    mocks.sessionFindUnique.mockResolvedValue({
      ...validSession(token),
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.sessionDelete).not.toHaveBeenCalled();
  });

  it("returns unauthenticated safely for a revoked session record", async () => {
    mocks.cookieGet.mockReturnValue({ name: sessionCookieName, value: "revoked-token" });
    mocks.sessionFindUnique.mockResolvedValue(null);

    await expect(getCurrentSession()).resolves.toBeNull();
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.sessionDelete).not.toHaveBeenCalled();
  });

  it("returns a valid database-backed session without mutating cookies", async () => {
    const token = "valid-token";
    const session = validSession(token);
    mocks.cookieGet.mockReturnValue({ name: sessionCookieName, value: token });
    mocks.sessionFindUnique.mockResolvedValue(session);

    await expect(getCurrentSession()).resolves.toEqual(session);
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.sessionDelete).not.toHaveBeenCalled();
  });

  it("sign-out deletes the current database session and clears the cookie from a mutation helper", async () => {
    const token = "sign-out-token";
    mocks.cookieGet.mockReturnValue({ name: sessionCookieName, value: token });
    mocks.sessionDeleteMany.mockResolvedValue({ count: 1 });

    await destroyCurrentSession();

    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken(token) },
    });
    expect(mocks.cookieDelete).toHaveBeenCalledWith(sessionCookieName);
  });
});
