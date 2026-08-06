import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadPeople } from "@/lib/people-service";

/**
 * The BFF endpoint.
 *
 * The initial page render does NOT go through here -- the server component
 * calls `loadPeople()` directly, avoiding a pointless HTTP hop to our own
 * process. This route exists for client-side refresh, and as the auditable
 * proof that the data itself is gated.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  /**
   * THE AUTHORISATION CHECK.
   *
   * Deliberately here, in the handler -- not in middleware. CVE-2025-29927
   * makes middleware-only checks bypassable via header spoofing. Without this
   * line the entire dataset is readable with one unauthenticated curl, however
   * convincing the login screen looks.
   */
  const session = await auth();
  if (session?.user == null) {
    return NextResponse.json(
      { error: "Sign in to view this data." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await loadPeople();

  if (!result.ok) {
    // 502: we are a gateway and our upstream failed. Not 500 -- the fault is
    // not in this service.
    return NextResponse.json(
      { error: result.error.message, kind: result.error.kind },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(result.payload, {
    headers: {
      // `private` because the response is only valid for this session, and
      // `no-store` so a shared proxy never serves one user's fetch to another.
      "Cache-Control": "private, no-store",
      // Makes the cache observable during review without a debugger.
      "X-Data-Source": result.cached ? "cache" : "sheets",
    },
  });
}
