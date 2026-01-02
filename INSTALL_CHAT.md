# Install Chat Dependencies

Run this command to install the required packages for the chat system:

```bash
npm install socket.io socket.io-client ws
```

Or if you prefer to add them manually to `package.json`:

```json
{
  "dependencies": {
    "socket.io": "^4.7.2",
    "socket.io-client": "^4.7.2",
    "ws": "^8.16.0"
  }
}
```

Then run:
```bash
npm install
```

## What These Packages Do

- **socket.io** - WebSocket server library for Node.js
- **socket.io-client** - WebSocket client library for browsers (optional - we use native WebSocket)
- **ws** - Native WebSocket server implementation (used for direct WebSocket connections)

After installation, restart your development server:

```bash
npm run dev
```


