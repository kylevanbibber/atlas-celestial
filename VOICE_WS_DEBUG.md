# Voice WebSocket Debugging Guide

## Issue
Premium voice engine fails to connect with "Auth timeout" error, falling back to WebSpeech.

## Symptoms
```
[PremiumVoice] Connecting to: ws://localhost:5001/ws/voice
[PremiumVoice] WebSocket connected, sending auth...
[PremiumVoice] Auth message sent
[PremiumVoice] Auth timeout - backend may not be running or configured
[VoiceEngine] Premium connection failed: Auth timeout
```

## Investigation Results

### ✅ What's Working:
- Backend server is running on port 5001 (PID: varies)
- WebSocket upgrade handler is configured in `app.js`
- Client successfully connects to WebSocket
- `initVoiceWebSocket()` is called during server startup

### ❌ What's NOT Working:
- Backend doesn't send any response to client messages
- Auth message from client is not being processed
- No `[VoiceWS]` logs appear when connection is made

## Files Modified
1. `backend/wsVoice.js` - Added debug logging to connection handler
2. `backend/test-voice-ws-detailed.js` - Created test script

## How to Debug

### Step 1: Restart Backend Server
```bash
cd backend
# Stop current server (Ctrl+C if running in terminal)
node app.js
# OR if using npm
npm start
```

### Step 2: Check Server Startup Logs
Look for these messages:
```
[VoiceWS] *** VOICE WEBSOCKET HANDLER INITIALIZED ***
[VoiceWS] WebSocket Server object: true
[VoiceWS] Setting up connection event listener...
Voice WebSocket running on ws://localhost:5001/ws/voice (Premium: true/false)
```

### Step 3: Run Test Script
```bash
cd backend
node test-voice-ws-detailed.js
```

Expected output if working:
```
✅ [CLIENT] WebSocket connected successfully
[CLIENT] 📤 Sending auth message
📥 ✅ Received message!
```

### Step 4: Check Backend Console
When the test runs, you should see:
```
[UPGRADE] WebSocket upgrade request received for: /ws/voice
[UPGRADE] *** ROUTING TO VOICE WEBSOCKET ***
[UPGRADE] Voice WebSocket upgrade complete, emitting connection
[VoiceWS] *** NEW VOICE CONNECTION RECEIVED ***
[VoiceWS] Sent connection_established message
[VoiceWS] *** MESSAGE RECEIVED *** TEXT
[VoiceWS] *** PARSED MESSAGE TYPE: auth ***
```

## Possible Causes

### 1. Event Listener Not Attached
The `wss.on('connection', ...)` handler might not be properly attached.

**Check:** Look for "Setting up connection event listener..." in startup logs

### 2. WebSocket Server Not Receiving Connections
The upgrade handler might not be emitting the connection event.

**Check:** Look for "[UPGRADE] Voice WebSocket upgrade complete" logs

### 3. Message Handler Not Firing
The `ws.on('message', ...)` handler inside the connection callback might not be working.

**Check:** Look for "MESSAGE RECEIVED" logs when sending test message

### 4. Environment Configuration
Deepgram or ElevenLabs API keys might be missing.

**Check:** Look at the "Premium: true/false" in startup logs

## Configuration Check

### Required Environment Variables
```bash
# In backend/.env
DEEPGRAM_API_KEY=your-key-here
ELEVENLABS_API_KEY=your-key-here
JWT_SECRET=your-secret-here
```

### Verify Configuration
```bash
cd backend
node -e "require('dotenv').config(); console.log('Deepgram:', !!process.env.DEEPGRAM_API_KEY); console.log('ElevenLabs:', !!process.env.ELEVENLABS_API_KEY);"
```

## Quick Fix Attempts

### If connection event isn't firing:
Check `app.js` line 320-323:
```javascript
voiceWss.handleUpgrade(req, socket, head, (ws) => {
  console.log('[UPGRADE] Voice WebSocket upgrade complete, emitting connection');
  voiceWss.emit('connection', ws, req);  // Make sure this matches the event name
});
```

### If message event isn't firing:
Check `wsVoice.js` line 78-96 - the message handler should be inside the connection callback.

## Test Without Auth
To verify basic connectivity, you can temporarily modify `wsVoice.js` to send a response immediately on connection (already added in debug version).

## Contact Points
- Frontend: `frontend/src/voice/PremiumVoiceEngine.js`
- Backend WS Handler: `backend/wsVoice.js`
- Backend Server: `backend/app.js` (lines 296-333)
- Upgrade Handler: `backend/app.js` (lines 305-333)

## Next Steps After Restart
1. Check if "[VoiceWS] *** NEW VOICE CONNECTION RECEIVED ***" appears in logs
2. Check if "Sent connection_established message" appears
3. Run test script and see if it receives the connection_established message
4. If test works, try the frontend roleplay call again

