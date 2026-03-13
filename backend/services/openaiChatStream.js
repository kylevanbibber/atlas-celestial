/**
 * OpenAI Chat Streaming Service
 * Handles streaming chat completions for roleplay
 */

const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';

/**
 * Stream a chat completion response
 * @param {Object} params - Parameters
 * @param {Array} params.messages - OpenAI format messages [{role, content}]
 * @param {string} params.systemPrompt - System prompt
 * @param {Object} callbacks - Streaming callbacks
 * @param {Function} callbacks.onToken - Called with each token
 * @param {Function} callbacks.onChunk - Called with accumulated chunk (sentence boundary)
 * @param {Function} callbacks.onComplete - Called with full text when done
 * @param {Function} callbacks.onError - Called on error
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise<string>} - Full response text
 */
async function streamChatCompletion(params, callbacks = {}, signal = null) {
  const { messages, systemPrompt } = params;
  const { onToken, onChunk, onComplete, onError } = callbacks;

  // Build message array with system prompt
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: fullMessages,
      max_tokens: 200,
      temperature: 0.7,
      stream: true
    });

    let fullText = '';
    let currentChunk = '';
    
    // Sentence boundary detection for chunking
    const sentenceEnders = /[.!?]+\s*$/;
    const minChunkLength = 30; // Minimum chars before looking for boundary

    for await (const part of stream) {
      // Check for abort
      if (signal?.aborted) {
        break;
      }

      const token = part.choices[0]?.delta?.content || '';
      
      if (token) {
        fullText += token;
        currentChunk += token;
        
        // Emit token
        onToken?.(token, fullText);

        // Check for chunk boundary (sentence end)
        if (currentChunk.length >= minChunkLength && sentenceEnders.test(currentChunk)) {
          onChunk?.(currentChunk.trim(), fullText);
          currentChunk = '';
        }
      }

      // Check for finish reason
      if (part.choices[0]?.finish_reason) {
        break;
      }
    }

    // Emit any remaining chunk
    if (currentChunk.trim() && !signal?.aborted) {
      onChunk?.(currentChunk.trim(), fullText);
    }

    if (!signal?.aborted) {
      onComplete?.(fullText);
    }

    return fullText;

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('[OpenAI] Stream aborted');
      return '';
    }
    
    console.error('[OpenAI] Streaming error:', error);
    onError?.(error);
    throw error;
  }
}

/**
 * Build system prompt for prospect roleplay
 * @param {string} scriptText - Sales script
 * @param {string} goalText - Call goal
 * @param {Array} rebuttals - Objection/response pairs
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {string}
 */
function buildProspectSystemPrompt(scriptText, goalText, rebuttals, difficulty = 'medium') {
  const rebuttalsText = rebuttals && rebuttals.length > 0
    ? rebuttals.map(r => `- "${r.objection}"`).join('\n')
    : '- "I\'m not interested"\n- "Send me information"\n- "I\'m busy right now"\n- "How much does it cost?"';

  // Difficulty-specific behavior
  const difficultySettings = {
    easy: {
      personality: `PERSONALITY (EASY MODE - Friendly & Open):
- Genuinely curious about what you have to offer
- Relatively open-minded and willing to listen
- Makes decisions somewhat independently
- Raise 0-1 objections, then be receptive to good responses
- If the agent handles you well, be ready to book an appointment`,
      objectionGuidance: `- Use at most ONE objection during the entire conversation
- Be receptive to the agent's responses
- Show interest if they make a good point`,
      tone: 'friendly and somewhat interested'
    },
    medium: {
      personality: `PERSONALITY (MEDIUM MODE - Moderately Skeptical):
- Busy with work/family responsibilities
- Protective of your time
- Makes decisions with spouse/partner
- Raise 2-3 objections throughout the conversation
- Not rude, but not a pushover either
- Can be convinced with good handling`,
      objectionGuidance: `- Use 2-3 objections during the conversation
- Show realistic hesitation and skepticism
- Be firm but fair in your responses`,
      tone: 'polite but skeptical'
    },
    hard: {
      personality: `PERSONALITY (HARD MODE - Challenging & Resistant):
- Very busy and protective of your time
- Highly skeptical of sales calls
- Have been burned by salespeople before
- Raise 4+ objections and be difficult to convince
- Make the agent really work to overcome your resistance
- Pushy, somewhat impatient, but not outright rude`,
      objectionGuidance: `- Use 4 or more objections throughout the conversation
- Be challenging and push back firmly
- Don't make it easy - make them earn the appointment
- Layer objections (one objection leads to another)`,
      tone: 'skeptical, busy, and resistant'
    }
  };

  const settings = difficultySettings[difficulty] || difficultySettings.medium;

  return `You are roleplaying as a PROSPECT who is RECEIVING a phone call. You are NOT the salesperson.

CRITICAL ROLE CLARITY:
- YOU ARE THE PROSPECT (the person being called)
- The USER is the SALES AGENT (the person making the call)
- You ANSWER the phone, you do NOT make sales pitches
- You should respond like a normal person who just received an unexpected call
- NEVER read scripts, NEVER pitch products, NEVER act like a salesperson

YOUR SITUATION:
- You are at home or work when you receive this call
- You did NOT initiate this call - you are being contacted
- You may or may not remember sending back a card or signing up for anything
- Your attitude is ${settings.tone}

HOW TO RESPOND:
- Keep responses SHORT (1-3 sentences max) like a real phone conversation
- Sound natural, not scripted
- Ask clarifying questions like "Who is this?" or "What is this about?"
${settings.objectionGuidance}
- You can eventually agree to an appointment if the agent handles you well, or politely decline if not

OBJECTIONS YOU CAN USE (choose based on conversation flow):
${rebuttalsText}

WHAT THE AGENT IS TRYING TO DO (for context only - don't help them):
${goalText || 'Book an appointment to explain benefits'}

${settings.personality}

FIRST MESSAGE GUIDANCE:
- If conversation just started, respond as if you just picked up the phone
- Simple responses like "Hello?" or "This is [made up name], who's calling?" are appropriate
- Do NOT launch into any sales pitch or script - you are receiving the call

Remember: You are being CALLED. You are NOT the caller. Respond naturally as someone who just answered their phone at this ${difficulty} difficulty level.`;
}

/**
 * Create an abortable stream controller
 * @returns {{ controller: AbortController, abort: Function }}
 */
function createAbortController() {
  const controller = new AbortController();
  return {
    controller,
    signal: controller.signal,
    abort: () => {
      controller.abort();
    }
  };
}

/**
 * Check if OpenAI streaming is available
 * @returns {boolean}
 */
function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

module.exports = {
  streamChatCompletion,
  buildProspectSystemPrompt,
  createAbortController,
  isConfigured
};

