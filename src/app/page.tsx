import { auth } from "@/auth";
import { loadPeople } from "@/lib/people-service";
import { SignInScreen } from "@/components/SignInScreen";
import { PeopleDashboard } from "@/components/PeopleDashboard";
import { ErrorState } from "@/components/states/StateViews";

/**
 * Server component.
 *
 * Two things happen here that cannot happen on the client:
 *
 * 1. The session is resolved server-side, so an unauthenticated visitor never
 *    receives the dashboard bundle at all. The gate is not a client-side
 *    conditional a devtools user can flip.
 *
 * 2. The data is loaded server-side and passed down as props. The alternative
 *    -- fetching from a client effect -- means every visitor sees a loading
 *    spinner while the browser makes a round trip to our own server, which
 *    then makes the same call this function makes directly.
 */
export default async function HomePage() {
  const session = await auth();

  if (session?.user == null) {
    return <SignInScreen />;
  }

  const result = await loadPeople();

  if (!result.ok) {
    return <ErrorState message={result.error.message} />;
  }

  return <PeopleDashboard initialPayload={result.payload} />;
}
