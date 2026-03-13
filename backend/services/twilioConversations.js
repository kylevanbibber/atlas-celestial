/**
 * Twilio Conversations Service
 * Handles group messaging via Twilio Conversations API
 */

const twilio = require('twilio');

// Lazy initialization
let client = null;

/**
 * Get or create Twilio client
 */
function getClient() {
  if (client) return client;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error('[Twilio Conversations] Missing credentials');
    return null;
  }

  client = twilio(accountSid, authToken);
  console.log('[Twilio Conversations] Client initialized');
  return client;
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  return `+${cleaned}`;
}

/**
 * Create a new group conversation
 * @param {string} friendlyName - Name for the conversation
 * @returns {Promise<Object>} - Conversation details
 */
async function createConversation(friendlyName) {
  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      return { success: false, error: 'Twilio client not initialized' };
    }

    const conversation = await twilioClient.conversations.v1.conversations.create({
      friendlyName: friendlyName || `Group Chat ${Date.now()}`,
    });

    console.log('[Twilio Conversations] Created conversation:', conversation.sid);

    return {
      success: true,
      conversationSid: conversation.sid,
      friendlyName: conversation.friendlyName,
    };
  } catch (error) {
    console.error('[Twilio Conversations] Error creating conversation:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Add SMS participant to a conversation (for group texting)
 * Note: For group SMS, only specify the participant's address (no proxy needed)
 * @param {string} conversationSid - Conversation SID
 * @param {string} phoneNumber - Participant phone number
 * @returns {Promise<Object>} - Participant details
 */
async function addSmsParticipant(conversationSid, phoneNumber) {
  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      return { success: false, error: 'Twilio client not initialized' };
    }

    const formattedNumber = formatPhoneNumber(phoneNumber);

    // For group texting, only specify address (Twilio handles routing automatically)
    const participant = await twilioClient.conversations.v1
      .conversations(conversationSid)
      .participants.create({
        'messagingBinding.address': formattedNumber,
      });

    console.log('[Twilio Conversations] Added SMS participant to group:', formattedNumber, participant.sid);

    return {
      success: true,
      participantSid: participant.sid,
      phoneNumber: formattedNumber,
    };
  } catch (error) {
    console.error('[Twilio Conversations] Error adding participant:', error.message);
    return { success: false, error: error.message, code: error.code };
  }
}

/**
 * Send a message to a conversation (all participants receive it)
 * @param {string} conversationSid - Conversation SID
 * @param {string} message - Message body
 * @param {string} author - Author identifier (optional)
 * @returns {Promise<Object>} - Message details
 */
async function sendMessage(conversationSid, message, author = 'Atlas') {
  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      return { success: false, error: 'Twilio client not initialized' };
    }

    const msg = await twilioClient.conversations.v1
      .conversations(conversationSid)
      .messages.create({
        body: message,
        author: author,
      });

    console.log('[Twilio Conversations] Message sent:', msg.sid);

    return {
      success: true,
      messageSid: msg.sid,
      body: msg.body,
    };
  } catch (error) {
    console.error('[Twilio Conversations] Error sending message:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create a group conversation and add multiple participants
 * @param {string} friendlyName - Name for the group
 * @param {string[]} phoneNumbers - Array of phone numbers to add
 * @param {string} senderIdentity - Identity for the sender (defaults to 'Atlas')
 * @returns {Promise<Object>} - Group details
 */
async function createGroupChat(friendlyName, phoneNumbers, senderIdentity = 'Atlas') {
  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      return { success: false, error: 'Twilio client not initialized' };
    }

    // Create the conversation
    const convResult = await createConversation(friendlyName);
    if (!convResult.success) {
      return convResult;
    }

    const conversationSid = convResult.conversationSid;
    const participants = [];
    const errors = [];

    // First, add the sender (app/Atlas) as a participant with identity
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    try {
      const senderParticipant = await twilioClient.conversations.v1
        .conversations(conversationSid)
        .participants.create({
          identity: senderIdentity,
          'messagingBinding.projectedAddress': twilioNumber,
        });
      console.log('[Twilio Conversations] Added sender participant:', senderIdentity, senderParticipant.sid);
    } catch (error) {
      console.error('[Twilio Conversations] Error adding sender:', error.message);
      return { success: false, error: `Failed to add sender: ${error.message}` };
    }

    // Add each SMS participant
    for (const phone of phoneNumbers) {
      const result = await addSmsParticipant(conversationSid, phone);
      if (result.success) {
        participants.push(result);
      } else {
        errors.push({ phone, error: result.error });
      }
    }

    console.log('[Twilio Conversations] Group created with sender +', participants.length, 'SMS participants');

    return {
      success: true,
      conversationSid,
      friendlyName,
      senderIdentity,
      participants,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('[Twilio Conversations] Error creating group:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a message to a group and create the group if it doesn't exist
 * @param {string[]} phoneNumbers - Array of phone numbers
 * @param {string} message - Message to send
 * @param {string} groupName - Optional group name
 * @param {string} senderIdentity - Optional sender identity (defaults to 'Atlas')
 * @returns {Promise<Object>} - Result
 */
async function sendGroupMessage(phoneNumbers, message, groupName, senderIdentity = 'Atlas') {
  try {
    // Create a new group for this message
    const groupResult = await createGroupChat(
      groupName || `Atlas Group ${new Date().toLocaleDateString()}`,
      phoneNumbers,
      senderIdentity
    );

    if (!groupResult.success) {
      return groupResult;
    }

    // Send the message with the sender's identity as author
    const msgResult = await sendMessage(groupResult.conversationSid, message, senderIdentity);

    return {
      success: msgResult.success,
      conversationSid: groupResult.conversationSid,
      messageSid: msgResult.messageSid,
      senderIdentity: groupResult.senderIdentity,
      participants: groupResult.participants,
      errors: groupResult.errors,
    };
  } catch (error) {
    console.error('[Twilio Conversations] Error sending group message:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * List all conversations
 */
async function listConversations() {
  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      return { success: false, error: 'Twilio client not initialized' };
    }

    const conversations = await twilioClient.conversations.v1.conversations.list({ limit: 50 });

    return {
      success: true,
      conversations: conversations.map(c => ({
        sid: c.sid,
        friendlyName: c.friendlyName,
        state: c.state,
        dateCreated: c.dateCreated,
      })),
    };
  } catch (error) {
    console.error('[Twilio Conversations] Error listing conversations:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a conversation
 */
async function deleteConversation(conversationSid) {
  try {
    const twilioClient = getClient();
    if (!twilioClient) {
      return { success: false, error: 'Twilio client not initialized' };
    }

    await twilioClient.conversations.v1.conversations(conversationSid).remove();

    console.log('[Twilio Conversations] Deleted conversation:', conversationSid);
    return { success: true };
  } catch (error) {
    console.error('[Twilio Conversations] Error deleting conversation:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createConversation,
  addSmsParticipant,
  sendMessage,
  createGroupChat,
  sendGroupMessage,
  listConversations,
  deleteConversation,
  formatPhoneNumber,
};

