import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, isNull, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { pairingSessions, pairingSignals } from "../../drizzle/schema";
import { getDb } from "../db";
import { createPairingExpiry, createPairingPin, hashPairingPin, isValidPin, normalizePin } from "../bridgeUtils";
import { publicProcedure, router } from "../_core/trpc";

const pinInput = z.string().transform(normalizePin).refine(isValidPin, "A six-digit PIN is required.");
const signalPayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("offer"), description: z.object({ type: z.string(), sdp: z.string() }) }),
  z.object({ kind: z.literal("answer"), description: z.object({ type: z.string(), sdp: z.string() }) }),
  z.object({ kind: z.literal("candidate"), candidate: z.record(z.string(), z.unknown()) }),
]);
const identityInput = z.object({ sessionId: z.string().min(8).max(32), roleToken: z.string().min(16).max(48) });

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The pairing service is unavailable." });
  return db;
}

async function clearExpiredPairings() {
  const db = await databaseOrThrow();
  const now = new Date();
  await db.delete(pairingSignals).where(lt(pairingSignals.createdAt, new Date(now.getTime() - 20 * 60 * 1000)));
  await db.delete(pairingSessions).where(lt(pairingSessions.expiresAt, now));
  return db;
}

async function sessionForToken(sessionId: string, roleToken: string) {
  const db = await databaseOrThrow();
  const records = await db.select().from(pairingSessions).where(and(eq(pairingSessions.id, sessionId), gt(pairingSessions.expiresAt, new Date()))).limit(1);
  const session = records[0];
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "This bridge has expired. Start a new pairing." });
  const role = session.hostToken === roleToken ? "host" : session.guestToken === roleToken ? "guest" : null;
  if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "This device is not authorized for the bridge." });
  return { db, session, role } as const;
}

export const bridgeRouter = router({
  create: publicProcedure.mutation(async () => {
    const db = await clearExpiredPairings();
    let pin = createPairingPin();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await db.select({ id: pairingSessions.id }).from(pairingSessions).where(and(eq(pairingSessions.pinHash, hashPairingPin(pin)), gt(pairingSessions.expiresAt, new Date()))).limit(1);
      if (!existing[0]) break;
      pin = createPairingPin();
    }
    const sessionId = nanoid(18);
    const hostToken = nanoid(28);
    const expiresAt = createPairingExpiry();
    await db.insert(pairingSessions).values({ id: sessionId, pinHash: hashPairingPin(pin), hostToken, expiresAt });
    return { sessionId, roleToken: hostToken, pin, expiresAt: expiresAt.getTime() };
  }),

  join: publicProcedure.input(z.object({ pin: pinInput })).mutation(async ({ input }) => {
    const db = await clearExpiredPairings();
    const sessions = await db.select().from(pairingSessions).where(and(eq(pairingSessions.pinHash, hashPairingPin(input.pin)), gt(pairingSessions.expiresAt, new Date()))).orderBy(asc(pairingSessions.createdAt)).limit(1);
    const session = sessions[0];
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "No active bridge was found for that PIN." });
    if (session.guestToken) throw new TRPCError({ code: "CONFLICT", message: "This bridge already has a paired device." });
    const guestToken = nanoid(28);
    await db.update(pairingSessions).set({ guestToken }).where(and(eq(pairingSessions.id, session.id), isNull(pairingSessions.guestToken)));
    const claims = await db.select().from(pairingSessions).where(eq(pairingSessions.id, session.id)).limit(1);
    if (claims[0]?.guestToken !== guestToken) throw new TRPCError({ code: "CONFLICT", message: "This bridge already has a paired device." });
    return { sessionId: session.id, roleToken: guestToken, pin: input.pin, expiresAt: session.expiresAt.getTime() };
  }),

  relay: publicProcedure.input(identityInput.extend({ payload: signalPayload })).mutation(async ({ input }) => {
    const { db, role } = await sessionForToken(input.sessionId, input.roleToken);
    await db.insert(pairingSignals).values({ sessionId: input.sessionId, recipientRole: role === "host" ? "guest" : "host", payload: JSON.stringify(input.payload) });
    return { accepted: true } as const;
  }),

  watch: publicProcedure.input(identityInput).mutation(async ({ input }) => {
    const { db, session, role } = await sessionForToken(input.sessionId, input.roleToken);
    const signals = await db.select().from(pairingSignals).where(and(eq(pairingSignals.sessionId, input.sessionId), eq(pairingSignals.recipientRole, role))).orderBy(asc(pairingSignals.id)).limit(80);
    return { expiresAt: session.expiresAt.getTime(), signals: signals.map(signal => ({ id: signal.id, payload: JSON.parse(signal.payload) })) };
  }),

  iceConfig: publicProcedure.query(() => {
    const turnUrls = (process.env.TURN_URLS ?? "").split(",").map(value => value.trim()).filter(Boolean);
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;
    return { iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }, ...(turnUrls.length && turnUsername && turnCredential ? [{ urls: turnUrls, username: turnUsername, credential: turnCredential }] : [])] };
  }),

  close: publicProcedure.input(identityInput).mutation(async ({ input }) => {
    const { db } = await sessionForToken(input.sessionId, input.roleToken);
    await db.delete(pairingSignals).where(eq(pairingSignals.sessionId, input.sessionId));
    await db.delete(pairingSessions).where(eq(pairingSessions.id, input.sessionId));
    return { closed: true } as const;
  }),
});
