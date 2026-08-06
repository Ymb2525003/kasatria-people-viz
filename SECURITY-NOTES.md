# Why there is no `proxy.ts` / `middleware.ts`

Next.js middleware (renamed `proxy.ts` in Next 16) is the conventional place
to gate authenticated routes. This project deliberately does **not** use it.

**Reason: CVE-2025-29927.** Next.js middleware checks are bypassable by
spoofing the `x-middleware-subrequest` header. Anything protected *only* by
middleware is effectively public.

Authorisation is therefore enforced at the two places that actually serve
data, both of which run server-side and cannot be bypassed by a header:

| Boundary | File | Check |
|---|---|---|
| Page | `src/app/page.tsx` | Server component calls `auth()`; a signed-out visitor never receives the dashboard bundle. |
| Data (initial) | `src/app/page.tsx` | Data is loaded server-side only after the session check passes. |
| Data (refresh) | `src/app/api/people/route.ts` | Route handler calls `auth()` and returns 401 before touching the Sheets API. |

The failure mode this avoids is common in submissions of this kind: the UI
route is gated, the API route is not, and `curl https://<host>/api/people`
returns the entire dataset to anyone.

## Verify it yourself

```bash
curl -i https://<your-deployment>/api/people
# Expected: HTTP/2 401  {"error":"Sign in to view this data."}
```
