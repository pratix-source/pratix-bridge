import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Short-lived metadata for a two-device WebRTC pairing. No transferred file bytes are stored. */
export const pairingSessions = mysqlTable(
  "pairing_sessions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    pinHash: varchar("pinHash", { length: 64 }).notNull(),
    hostToken: varchar("hostToken", { length: 48 }).notNull(),
    guestToken: varchar("guestToken", { length: 48 }),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("pairing_sessions_pin_expiry_idx").on(table.pinHash, table.expiresAt)]
);

/** Ephemeral WebRTC SDP and ICE candidates; they expire alongside the pairing session. */
export const pairingSignals = mysqlTable(
  "pairing_signals",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: varchar("sessionId", { length: 32 }).notNull(),
    recipientRole: mysqlEnum("recipientRole", ["host", "guest"]).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("pairing_signals_recipient_idx").on(table.sessionId, table.recipientRole, table.id)]
);
