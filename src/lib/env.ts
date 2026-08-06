import "server-only";
import { z } from "zod";

/**
 * Validates the server environment once, at module load.
 *
 * The common alternative is `process.env.GOOGLE_SHEET_ID!` scattered through
 * the codebase. That `!` is a lie to the compiler: a missing variable becomes
 * a cryptic runtime 500 in production. Here a misconfigured deploy fails
 * immediately with a message naming the exact variable.
 *
 * `import "server-only"` makes importing this from a client component a
 * BUILD error rather than a leaked credential.
 */
const serverEnvSchema = z.object({
  AUTH_SECRET: z.string().min(32, "must be >= 32 chars (openssl rand -base64 32)"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_SHEETS_API_KEY: z.string().min(1),
  GOOGLE_SHEET_ID: z.string().min(1),
  GOOGLE_SHEET_RANGE: z.string().min(1).default("People!A2:F"),
  SHEETS_CACHE_TTL_MS: z.coerce.number().int().positive().default(60_000),
});

export type ServerEnv = Readonly<z.infer<typeof serverEnvSchema>>;

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${details}`);
  }
  return Object.freeze(parsed.data);
}

export const env: ServerEnv = loadServerEnv();
