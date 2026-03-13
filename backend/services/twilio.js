/**
 * Twilio SMS Service
 * Handles sending SMS messages via Twilio API
 */

const twilio = require('twilio');

// Lazy initialization - client is created on first use
let client = null;

/**
 * Get or create Twilio client (lazy initialization)
 * This ensures environment variables are read at runtime, not module load time
 */
function getClient() {
  if (client) {
    return client;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  console.log('[Twilio] Initializing client...', {
    hasAccountSid: !!accountSid,
    hasAuthToken: !!authToken,
    accountSidPrefix: accountSid ? accountSid.substring(0, 6) : 'missing'
  });

  if (!accountSid || !authToken) {
    console.error('[Twilio] Missing credentials:', {
      TWILIO_ACCOUNT_SID: accountSid ? 'set' : 'NOT SET',
      TWILIO_AUTH_TOKEN: authToken ? 'set' : 'NOT SET'
    });
    return null;
  }

  try {
    client = twilio(accountSid, authToken);
    console.log('[Twilio] Client initialized successfully');
    return client;
  } catch (error) {
    console.error('[Twilio] Failed to initialize client:', error.message);
    return null;
  }
}

/**
 * Get the Twilio phone number from environment
 */
function getPhoneNumber() {
  return process.env.TWILIO_PHONE_NUMBER;
}

/**
 * Format phone number to E.164 format
 * @param {string} phone - Phone number in various formats
 * @returns {string} - Phone number in E.164 format
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with +, keep it
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If it's 10 digits, assume US and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If it's 11 digits and starts with 1, add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // Default: add + prefix
  return `+${cleaned}`;
}

/**
 * Send an SMS message via Twilio
 * @param {string|string[]} toNumber - Recipient phone number or array of numbers for group MMS
 * @param {string} message - Message text
 * @param {number} userId - Atlas user ID sending the message
 * @param {string[]} mediaUrls - Optional array of media URLs for MMS
 * @returns {Promise<Object>} - Twilio API response
 */
async function sendSMS({ toNumber, message, userId, mediaUrls, statusCallback }) {
  try {
    const twilioClient = getClient();
    const fromNumber = getPhoneNumber();

    if (!twilioClient) {
      console.error('[Twilio] Client not initialized - credentials missing');
      return {
        success: false,
        error: 'Twilio client not initialized - check credentials',
      };
    }

    if (!fromNumber) {
      console.error('[Twilio] TWILIO_PHONE_NUMBER not set');
      return {
        success: false,
        error: 'Twilio phone number not configured',
      };
    }

    // Handle single or multiple recipients
    const isGroupMessage = Array.isArray(toNumber);
    const recipients = isGroupMessage 
      ? toNumber.map(num => formatPhoneNumber(num))
      : [formatPhoneNumber(toNumber)];
    
    console.log('[Twilio] Sending', isGroupMessage ? 'GROUP MMS' : 'SMS', ':', { 
      recipients, 
      messageLength: message.length, 
      userId,
      from: fromNumber,
      hasMedia: !!(mediaUrls && mediaUrls.length > 0)
    });

    // For group messages, send as MMS with multiple recipients
    const messageConfig = {
      body: message,
      from: fromNumber,
    };

    if (isGroupMessage) {
      // Group MMS: send to array of recipients
      // Note: Twilio requires media for true group MMS functionality
      messageConfig.to = recipients;
      messageConfig.mediaUrl = mediaUrls || ['https://i.imgur.com/transparent.png']; // Tiny transparent pixel if no media provided
    } else {
      // Single recipient
      messageConfig.to = recipients[0];
      if (mediaUrls && mediaUrls.length > 0) {
        messageConfig.mediaUrl = mediaUrls;
      }
    }

    if (statusCallback) {
      messageConfig.statusCallback = statusCallback;
    }

    const response = await twilioClient.messages.create(messageConfig);

    console.log('[Twilio] Message sent successfully:', {
      sid: response.sid,
      status: response.status,
      to: response.to,
      isGroup: isGroupMessage,
    });

    return {
      success: true,
      messageId: response.sid,
      sessionId: response.sid, // For compatibility with TextMagic response format
      isGroupMessage,
      recipients,
      data: {
        sid: response.sid,
        status: response.status,
        to: response.to,
        from: response.from,
        dateCreated: response.dateCreated,
      },
    };
  } catch (error) {
    console.error('[Twilio] Error sending SMS:', error.message);
    
    // Log detailed error info
    if (error.code) {
      console.error('[Twilio] Error code:', error.code);
    }
    if (error.moreInfo) {
      console.error('[Twilio] More info:', error.moreInfo);
    }
    
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      moreInfo: error.moreInfo,
    };
  }
}

/**
 * Get account balance from Twilio
 * @returns {Promise<Object>} - Balance information
 */
async function getBalance() {
  try {
    const twilioClient = getClient();
    
    if (!twilioClient) {
      return {
        success: false,
        error: 'Twilio client not initialized',
      };
    }

    const balance = await twilioClient.balance.fetch();

    return {
      success: true,
      balance: parseFloat(balance.balance),
      currency: balance.currency,
    };
  } catch (error) {
    console.error('[Twilio] Error fetching balance:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get message status from Twilio
 * @param {string} messageId - Twilio message SID
 * @returns {Promise<Object>} - Message status
 */
async function getMessageStatus(messageId) {
  try {
    const twilioClient = getClient();
    
    if (!twilioClient) {
      return {
        success: false,
        error: 'Twilio client not initialized',
      };
    }

    const message = await twilioClient.messages(messageId).fetch();

    return {
      success: true,
      status: message.status,
      data: {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      },
    };
  } catch (error) {
    console.error('[Twilio] Error fetching message status:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  sendSMS,
  getBalance,
  getMessageStatus,
  formatPhoneNumber,
};
