import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js v5, Google provider, JWT session strategy.
 *
 * WHY JWT AND NOT A DATABASE SESSION: we deliberately have no database (see
 * README). The JWT strategy keeps session state in a signed cookie, so auth
 * adds zero infrastructure. The trade-off -- sessions cannot be revoked
 * server-side before expiry -- is acceptable for a read-only visualisation
 * with no privileged actions.
 *
 * SCOPES: only what identity requires. We do NOT request a Sheets scope,
 * because the user's Google account is never used to read the spreadsheet;
 * the server does that with its own API key. Requesting spreadsheet access
 * from the signing-in user would be over-permissioned and a genuine red flag.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // Credentials are named EXPLICITLY rather than relying on Auth.js's
      // implicit discovery of AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
      //
      // Why this matters: with implicit discovery, a variable named anything
      // else is silently ignored -- the provider initialises with an undefined
      // client id and the failure only appears as `client_id=undefined` in the
      // OAuth redirect, which Google reports as the misleading
      // "invalid_client / The OAuth client was not found".
      //
      // Naming them here keeps .env.example honest about what this app
      // actually reads, and lets the env validation in src/lib/env.ts catch a
      // missing credential at startup instead of mid-handshake.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { scope: "openid email profile", prompt: "select_account" },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/", error: "/" },
  callbacks: {
    /** Keep the token minimal -- it travels in a cookie on every request. */
    jwt({ token }) {
      return token;
    },
    session({ session, token }) {
      if (token.sub !== undefined) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
});