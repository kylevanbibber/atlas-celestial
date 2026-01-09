/**
 * TextMagic SMS Service
 * Handles sending SMS messages via TextMagic API
 */

const axios = require('axios');

const TEXTMAGIC_API_KEY = 'DGcOLUD8D63mEbcf4vzHE5m42DvAHf';
const TEXTMAGIC_USERNAME = 'kylevanbibber';
const TEXTMAGIC_API_URL = 'https://rest.textmagic.com/api/v2';

/**
 * Send an SMS message via TextMagic
 * @param {string} toNumber - Recipient phone number (E.164 format recommended)
 * @param {string} message - Message text
 * @param {number} userId - Atlas user ID sending the message
 * @returns {Promise<Object>} - TextMagic API response
 */
async function sendSMS({ toNumber, message, userId }) {
  try {
    console.log('[TextMagic] Sending SMS:', { toNumber, messageLength: message.length, userId });

    // Prepare the request
    const response = await axios.post(
      `${TEXTMAGIC_API_URL}/messages`,
      {
        text: message,
        phones: toNumber, // Can be a single number or comma-separated list
      },
      {
        headers: {
          'X-TM-Username': TEXTMAGIC_USERNAME,
          'X-TM-Key': TEXTMAGIC_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[TextMagic] SMS sent successfully:', response.data);

    return {
      success: true,
      messageId: response.data.id,
      sessionId: response.data.sessionId,
      data: response.data,
    };
  } catch (error) {
    console.error('[TextMagic] Error sending SMS:', error.response?.data || error.message);
    
    // Log detailed validation errors if available
    if (error.response?.data?.errors) {
      console.error('[TextMagic] Validation errors:', JSON.stringify(error.response.data.errors, null, 2));
    }
    
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      errorCode: error.response?.data?.code,
      validationErrors: error.response?.data?.errors,
    };
  }
}

/**
 * Get account balance from TextMagic
 * @returns {Promise<Object>} - Balance information
 */
async function getBalance() {
  try {
    const response = await axios.get(`${TEXTMAGIC_API_URL}/user`, {
      headers: {
        'X-TM-Username': TEXTMAGIC_USERNAME,
        'X-TM-Key': TEXTMAGIC_API_KEY,
      },
    });

    return {
      success: true,
      balance: response.data.balance,
      currency: response.data.currency,
    };
  } catch (error) {
    console.error('[TextMagic] Error fetching balance:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

/**
 * Get message status from TextMagic
 * @param {string} messageId - TextMagic message ID
 * @returns {Promise<Object>} - Message status
 */
async function getMessageStatus(messageId) {
  try {
    const response = await axios.get(`${TEXTMAGIC_API_URL}/messages/${messageId}`, {
      headers: {
        'X-TM-Username': TEXTMAGIC_USERNAME,
        'X-TM-Key': TEXTMAGIC_API_KEY,
      },
    });

    return {
      success: true,
      status: response.data.status,
      data: response.data,
    };
  } catch (error) {
    console.error('[TextMagic] Error fetching message status:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

module.exports = {
  sendSMS,
  getBalance,
  getMessageStatus,
};

