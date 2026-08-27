# Zero-Configuration Vercel Deployment

Pratix Bridge now publishes as a static Vite project. A user can upload the provided project files to GitHub, import that repository in Vercel, and select **Deploy** without adding a database URL, a server process, or environment variables.

The default pairing implementation uses PeerJS Cloud for temporary connection signaling. The PeerJS documentation states that its default cloud server handles the signaling handshake and that data moves directly between browsers after that handshake.[1] The client derives a temporary PeerJS brokering identity from a six-digit PIN, expires the PIN after ten minutes, and moves messages and file chunks across a WebRTC-backed data connection.

| Deployment component | Included configuration | Required user action |
|---|---|---|
| Static application build | `vercel.json`, Vite build script | GitHub repository upload and Vercel Deploy |
| Default connection signaling | PeerJS client with its documented default cloud endpoint | None |
| Device-to-device payload | Browser WebRTC DataConnection | None |
| PWA installation | Manifest, service worker and app icon URLs | None |

The default connectivity path does not cover every restrictive network. PeerJS documents that a pair of symmetric-NAT networks can require TURN to establish a connection at all.[2] This optional operational upgrade has intentionally been left out of the default setup so the requested GitHub-to-Vercel path needs no additional setup.

## References

[1] [PeerJS FAQ — signaling and direct data flow](https://peerjs.com/client/faq)

[2] [PeerJS FAQ — symmetric NAT caveat](https://peerjs.com/client/faq)
