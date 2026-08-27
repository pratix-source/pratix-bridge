# Local ZIP Launch Verification

The ZIP root’s `index.html` was opened through the local file protocol on 2026-08-27. It immediately redirected to `START-HERE.html`, where the local preview and Vercel publishing steps were visible instead of a blank page.

The guidance was updated to distinguish a local Vite preview from a production Vercel deployment. The public GitHub-to-Vercel path uses the built-in default PeerJS Cloud signaling route and does not require the user to set a database or environment variable.
