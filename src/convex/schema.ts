import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// Incident type validator
export const INCIDENT_TYPES = {
  POTHOLE: "pothole",
  LANDSLIDE: "landslide",
  ACCIDENT: "accident",
  FLOOD: "flood",
  CONSTRUCTION: "construction",
  DEBRIS: "debris",
  ICE: "ice",
  OTHER: "other",
} as const;

export const incidentTypeValidator = v.union(
  v.literal(INCIDENT_TYPES.POTHOLE),
  v.literal(INCIDENT_TYPES.LANDSLIDE),
  v.literal(INCIDENT_TYPES.ACCIDENT),
  v.literal(INCIDENT_TYPES.FLOOD),
  v.literal(INCIDENT_TYPES.CONSTRUCTION),
  v.literal(INCIDENT_TYPES.DEBRIS),
  v.literal(INCIDENT_TYPES.ICE),
  v.literal(INCIDENT_TYPES.OTHER),
);
export type IncidentType = Infer<typeof incidentTypeValidator>;

// Severity validator
export const SEVERITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export const severityValidator = v.union(
  v.literal(SEVERITY_LEVELS.LOW),
  v.literal(SEVERITY_LEVELS.MEDIUM),
  v.literal(SEVERITY_LEVELS.HIGH),
  v.literal(SEVERITY_LEVELS.CRITICAL),
);
export type Severity = Infer<typeof severityValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Road incidents reported by users
    incidents: defineTable({
      userId: v.id("users"),
      type: incidentTypeValidator,
      severity: severityValidator,
      lat: v.number(),
      lng: v.number(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      status: v.union(
        v.literal("active"),
        v.literal("resolved"),
        v.literal("verified"),
        v.literal("permanent"),
      ),
      reports: v.number(),
      reportedBy: v.string(),
      verifiedBy: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_type", ["type"])
      .index("by_status", ["status"])
      .index("by_location", ["lat", "lng"]),

    // User sessions and activity history
    sessions: defineTable({
      userId: v.id("users"),
      type: v.union(
        v.literal("route"),
        v.literal("report"),
        v.literal("activity"),
      ),
      title: v.string(),
      originLat: v.optional(v.number()),
      originLng: v.optional(v.number()),
      originName: v.optional(v.string()),
      destLat: v.optional(v.number()),
      destLng: v.optional(v.number()),
      destName: v.optional(v.string()),
      riskScore: v.optional(v.number()),
      travelTime: v.optional(v.string()),
      incidentsNearby: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_created", ["createdAt"]),

    // Stellar wallet — custodial, one per user
    // stellarSecretKeyEncrypted is AES-256-GCM encrypted using STELLAR_KEY_ENCRYPTION_SECRET env var.
    // It is NEVER returned by any query — enforced by omitting from query return shapes.
    wallets: defineTable({
      userId: v.id("users"),
      stellarPublicKey: v.string(),
      stellarSecretKeyEncrypted: v.string(),
      provisionedAt: v.optional(v.number()),
      status: v.union(v.literal("active"), v.literal("suspended")),
    }).index("by_user", ["userId"]),

    // Append-only reward ledger — every row is an audit trail entry.
    // NEVER update or delete a row — this is a financial record.
    rewardTransactions: defineTable({
      userId: v.id("users"),
      incidentId: v.optional(v.id("incidents")),
      amount: v.number(),
      reason: v.union(
        v.literal("report_verified"),
        v.literal("verification_participation"),
        v.literal("manual_adjustment"),
      ),
      stellarTransactionHash: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("submitted"),
        v.literal("confirmed"),
        v.literal("failed"),
      ),
      createdAt: v.number(),
      confirmedAt: v.optional(v.number()),
      retryCount: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_incident", ["incidentId", "reason"])
      .index("by_status", ["status"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
