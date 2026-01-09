/**
 * Detailed test script to verify voice WebSocket connectivity
 */

const WebSocket = require('ws');

console.log('='.repeat(80));
console.log('Testing voice WebSocket connection with detailed logging...');
console.log('='.repeat(80));

const ws = new WebSocket('ws://localhost:5001/ws/voice');

let messageReceived = false;

ws.on('open', () => {
  console.log('✅ [CLIENT] WebSocket connected successfully');
  console.log('[CLIENT] WebSocket readyState:', ws.readyState);
  
  // Send auth message
  const testMessage = {
    type: 'auth',
    token: 'test-token-12345'
  };
  
  console.log('[CLIENT] 📤 Sending auth message:', JSON.stringify(testMessage, null, 2));
  ws.send(JSON.stringify(testMessage));
  console.log('[CLIENT] ✅ Auth message sent');
  
  // Set timeout to check if we get a response
  setTimeout(() => {
    if (!messageReceived) {
      console.log('[CLIENT] ❌ No response received after 5 seconds');
      console.log('[CLIENT] This suggests the backend WebSocket handler is not processing messages');
    }
    ws.close();
  }, 5000);
});

ws.on('message', (data) => {
  messageReceived = true;
  console.log('[CLIENT] 📥 ✅ Received message!');
  console.log('[CLIENT] Raw data:', data.toString());
  try {
    const parsed = JSON.parse(data.toString());
    console.log('[CLIENT] Parsed message:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('[CLIENT] Failed to parse as JSON:', e.message);
  }
});

ws.on('error', (error) => {
  console.error('[CLIENT] ❌ WebSocket error:', error.message);
  console.error('[CLIENT] Error stack:', error.stack);
});

ws.on('close', (code, reason) => {
  console.log('[CLIENT] 🔌 WebSocket connection closed');
  console.log('[CLIENT] Close code:', code);
  console.log('[CLIENT] Close reason:', reason.toString());
  console.log('='.repeat(80));
  console.log('Test Summary:');
  console.log('- Connection: ✅ SUCCESS');
  console.log('- Message sent: ✅ SUCCESS');
  console.log('- Response received:', messageReceived ? '✅ SUCCESS' : '❌ FAILED');
  console.log('='.repeat(80));
  process.exit(messageReceived ? 0 : 1);
});

// Overall timeout
setTimeout(() => {
  console.log('[CLIENT] ❌ Test timed out after 10 seconds');
  ws.close();
}, 10000);

