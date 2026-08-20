import type { AuthConfig } from "convex/server";

const freebuffIssuer =
  process.env.VLY_CONVEX_AUTH_ISSUER ?? "https://freebuff.com";

export default {
  providers: [
    {
      // Fall back to SITE_URL if CONVEX_SITE_URL is undefined
      domain: process.env.CONVEX_SITE_URL ?? process.env.SITE_URL!,
      applicationID: "convex",
    },
    {
      type: "customJwt",
      issuer: freebuffIssuer,
      jwks: `${freebuffIssuer}/api/web/.well-known/jwks.json`,
      applicationID: "vly-convex",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;