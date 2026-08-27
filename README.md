# Pratix Bridge

Pratix Bridge is a responsive, multilingual browser application for direct text and file handoffs. Two devices pair with a six-digit PIN or a QR code, then use a WebRTC DataChannel for the transfer payload. The server stores only short-lived pairing metadata and signaling messages; uploaded file bytes are not persisted by the application.

## Local development

Install dependencies with `pnpm install`, then start the project with `pnpm dev`. Create the pairing database migration with `pnpm drizzle-kit generate`, review the generated SQL, and apply it to the target MySQL-compatible database. Run `pnpm test`, `pnpm check`, and `pnpm build` before publishing.

## GitHub and Vercel deployment

Push this repository to GitHub and import it from the Vercel dashboard. The included `vercel.json` builds the Vite client into `dist/public`, serves it as a single-page application, and exposes the dynamic `api/trpc/[...trpc].ts` handler for the short-lived signaling API. Set `DATABASE_URL` in Vercel to a MySQL-compatible database reachable by the deployment. This is required because serverless functions may scale horizontally and cannot safely keep pairing sessions only in process memory.

Set the production domain to `bridge.pratix.io` (or update every canonical and sitemap URL if a different domain is selected). The supplied canonical URL, sitemap, robots file, Open Graph metadata, and WebApplication JSON-LD are set for `https://bridge.pratix.io/`.

| Environment variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | Stores pairing session and signaling metadata for ten minutes. |
| `TURN_URLS` | Recommended | Comma-separated TURN URLs for restrictive network environments. |
| `TURN_USERNAME` | With TURN | TURN username; use short-lived credentials in production. |
| `TURN_CREDENTIAL` | With TURN | TURN credential required by the browser to request relay connectivity. |

The default STUN server lets the product try direct browser-to-browser connectivity. A TURN configuration is recommended for wider network compatibility; its relay use is a WebRTC fallback and does not change the user-facing transfer flow.

## Important production notes

Do not treat the preview endpoint as a TURN service. For production, supply a managed TURN service or deploy coturn with ephemeral credentials. Pairing PINs expire after ten minutes and are stored only as SHA-256 hashes. File contents are not written to the database. The client uses chunks and DataChannel backpressure to keep ordinary transfers responsive; set user-facing size limits in policy and test your selected browser/network mix before a public release.
