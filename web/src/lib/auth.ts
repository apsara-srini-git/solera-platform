import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";

const SESSION_COOKIE = "solera_session";
const ANON_COOKIE = "solera_anon";
const SESSION_DAYS = 30;

export const newToken = (bytes = 24) => randomBytes(bytes).toString("base64url");

export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function anonId(): Promise<string | null> {
  return (await cookies()).get(ANON_COOKIE)?.value ?? null;
}

/** Anonymous id lives in a browser-session cookie (no maxAge) - gone when the browser closes. Call only from actions. */
export async function ensureAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE)?.value;
  if (existing) return existing;
  const id = newToken(16);
  store.set(ANON_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return id;
}

/** Creates a session and moves any anonymous projects from this browser into the account. */
export async function startSession(userId: string) {
  const store = await cookies();
  const token = newToken();
  await db.session.create({
    data: { id: token, userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) },
  });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  const anon = store.get(ANON_COOKIE)?.value;
  if (anon) {
    await db.$transaction([
      db.project.updateMany({ where: { anonId: anon, userId: null }, data: { userId, anonId: null } }),
      db.protocolUpload.updateMany({ where: { anonId: anon, userId: null }, data: { userId, anonId: null } }),
    ]);
    store.delete(ANON_COOKIE);
  }
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: token } });
  store.delete(SESSION_COOKIE);
}

/** Loads a project only if the caller (user or anonymous browser) owns it. */
export async function ownedProject(projectId: string) {
  const user = await currentUser();
  const anon = await anonId();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (user && project.userId === user.id) return project;
  if (!project.userId && anon && project.anonId === anon) return project;
  return null;
}
