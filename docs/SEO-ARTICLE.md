# Secure P2P File Transfer Without Shared Wi-Fi

Pratix Bridge is a browser-based **P2P file transfer** and direct text transfer tool designed for quick, private handoffs between two devices. Instead of asking both devices to use the same Wi-Fi network, it creates a short-lived pairing session with a six-digit PIN or QR code. Once the devices are paired, the browser uses WebRTC DataChannels to carry text and file data directly between peers.

This approach answers several common needs at once: secure file transfer without shared Wi-Fi, a practical way to send files between a phone and laptop, and an uncomplicated direct device-to-device file sharing flow. The pairing service only carries temporary connection setup messages; it does not store the files selected for transfer. WebRTC DataChannels are intended for arbitrary peer-to-peer data exchange and use the WebRTC security model for transport protection.[1]

For a reliable **WebRTC file transfer** experience across different mobile and office networks, pairing services should be configured with STUN and, where network conditions require it, a TURN relay. STUN helps a peer discover the network addresses it can use, while TURN relays connectivity when a direct route cannot be established.[2]

## References

[1] [MDN WebRTC API — Using WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels)

[2] [MDN WebRTC connectivity — Protocols](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols)
