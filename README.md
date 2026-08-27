# Pratix Bridge

Pratix Bridge is a responsive, multilingual browser application for direct text and file handoffs. Two devices pair with a six-digit PIN or a QR code, then transfer through a WebRTC DataChannel. The built-in default uses PeerJS Cloud only for temporary connection signaling; transfer payloads go directly between the two browsers.

> **Opening `client/index.html` directly after extracting the ZIP is not supported.** The application needs its local pairing API, so it must run through a local server or Vercel. For the fastest local preview, run `START-PRATIX-BRIDGE.bat` on Windows or `START-PRATIX-BRIDGE.command` on macOS/Linux. If you open `client/index.html` accidentally, it now displays this guidance instead of a blank screen.

## Local development

Install dependencies with `pnpm install`, then start the project with `pnpm dev`. Create the pairing database migration with `pnpm drizzle-kit generate`, review the generated SQL, and apply it to the target MySQL-compatible database. Run `pnpm test`, `pnpm check`, and `pnpm build` before publishing.

| Platform | Fast local start | Result |
|---|---|---|
| Windows | Double-click `START-PRATIX-BRIDGE.bat` | Installs dependencies, opens a server window, then opens `http://localhost:3000`. |
| macOS/Linux | Run `chmod +x START-PRATIX-BRIDGE.command && ./START-PRATIX-BRIDGE.command` | Installs dependencies, runs the server, then attempts to open `http://localhost:3000`. |
| Any platform | `pnpm install && pnpm dev` | Starts the project manually at `http://localhost:3000`. |

## GitHub and Vercel deployment — no configuration required

Push this repository to GitHub, import the repository in Vercel, and click **Deploy**. No environment variable, database, server, or TURN configuration is required for the supplied default flow. Vercel builds this as a static Vite site, while the default PeerJS Cloud service coordinates only the short-lived WebRTC handshake. The selected text and files do not pass through your Vercel deployment during a direct connection.[1]

Set the production domain to `bridge.pratix.io` (or update every canonical and sitemap URL if a different domain is selected). The supplied canonical URL, sitemap, robots file, Open Graph metadata, and WebApplication JSON-LD are set for `https://bridge.pratix.io/`.

The default connection setup works for ordinary networks without a project-specific service. Very restrictive corporate networks or two symmetric-NAT devices may still need TURN to establish any WebRTC connection; the default public experience does not ask you to configure it.[2]

## Important production notes

Pairing PINs expire after ten minutes and are used only to derive a temporary PeerJS brokering identity. The client uses chunks and DataChannel backpressure to keep ordinary transfers responsive. The default cloud signaling service may be replaced later with a dedicated peer server and TURN service if you want to operate your own networking stack.

## References

[1] [PeerJS FAQ — signaling and direct data flow](https://peerjs.com/client/faq)

[2] [PeerJS FAQ — symmetric NAT and TURN caveat](https://peerjs.com/client/faq)
