/**
 * OpenAI Service for AI-powered features
 * Handles roleplay prospect simulation and scoring
 */
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';

/**
 * Generate a prospect reply for roleplay training
 * @param {Object} params - Parameters for the AI call
 * @param {string} params.scriptText - The sales script being used
 * @param {string} params.goalText - The goal of the call (book appointment, etc.)
 * @param {Array} params.rebuttals - Array of objection/response pairs
 * @param {Array} params.messages - Conversation history [{role: 'user'|'ai', content: '...'}]
 * @returns {Promise<string>} - The AI prospect's reply
 */
async function generateProspectReply({ scriptText, goalText, rebuttals, messages, difficulty }) {
  // Build the system prompt
  const systemPrompt = buildProspectSystemPrompt(scriptText, goalText, rebuttals, difficulty || 'medium');
  
  // Convert messages to OpenAI format
  const conversationHistory = messages.map(msg => ({
    role: msg.role === 'ai' ? 'assistant' : 'user',
    content: msg.content
  }));

  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || "I'm sorry, I didn't catch that. Could you repeat?";
  } catch (error) {
    console.error('[OpenAI] Error generating prospect reply:', error);
    throw error;
  }
}

/**
 * Build the system prompt for the prospect AI
 */
function buildProspectSystemPrompt(scriptText, goalText, rebuttals, difficulty = 'medium') {
  const rebuttalsText = rebuttals && rebuttals.length > 0
    ? rebuttals.map(r => `- "${r.objection}"`).join('\n')
    : '- "I\'m not interested"\n- "Send me information"\n- "I\'m busy right now"\n- "How much does it cost?"';

  // Difficulty-specific behavior (matching openaiChatStream.js)
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
 * Score a completed roleplay session and provide coaching feedback
 * @param {Object} params - Parameters for scoring
 * @param {string} params.scriptText - The sales script being used
 * @param {string} params.goalText - The goal of the call
 * @param {Array} params.rebuttals - Array of objection/response pairs
 * @param {Array} params.transcript - Full conversation [{role, content}]
 * @returns {Promise<Object>} - Scoring result with rubric and feedback
 */
async function scoreRoleplaySession({ scriptText, goalText, rebuttals, transcript }) {
  const systemPrompt = buildScoringSystemPrompt(scriptText, goalText, rebuttals);
  
  // Format transcript for analysis
  const formattedTranscript = transcript.map(msg => 
    `${msg.role === 'user' ? 'AGENT' : 'PROSPECT'}: ${msg.content}`
  ).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please analyze this roleplay call:\n\n${formattedTranscript}` }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('[OpenAI] Failed to parse scoring response, retrying with repair prompt');
      return await retryScoring(content);
    }
  } catch (error) {
    console.error('[OpenAI] Error scoring roleplay session:', error);
    throw error;
  }
}

/**
 * Build the system prompt for scoring
 */
function buildScoringSystemPrompt(scriptText, goalText, rebuttals) {
  return `You are an expert sales coach analyzing a roleplay training call. 

THE AGENT'S SCRIPT:
${scriptText || 'Standard insurance benefits call'}

THE CALL GOAL:
${goalText || 'Book an appointment to explain benefits'}

REBUTTALS THE AGENT SHOULD USE:
${rebuttals && rebuttals.length > 0 
  ? rebuttals.map(r => `- Objection: "${r.objection}" → Response: "${r.response}"`).join('\n')
  : 'Standard objection handling'}

Analyze the conversation and return a JSON object with this EXACT structure:
{
  "appointmentBooked": boolean,
  "appointmentDetails": { "date": "string or null", "time": "string or null", "notes": "string or null" } | null,
  "rubric": {
    "discovery": <0-5 score for asking questions and understanding prospect needs>,
    "objectionHandling": <0-5 score for handling objections effectively>,
    "clarity": <0-5 score for clear communication and script adherence>,
    "nextStepAsk": <0-5 score for closing and asking for the appointment>
  },
  "strengths": ["string array of 2-3 things the agent did well"],
  "improvements": ["string array of 2-3 specific areas to improve"],
  "betterPhrasing": [
    { "situation": "what happened in the call", "suggestion": "better way to phrase it" }
  ]
}

Be constructive but honest. Focus on actionable feedback. Return ONLY valid JSON.`;
}

/**
 * Retry scoring with a repair prompt if JSON parsing fails
 */
async function retryScoring(invalidContent) {
  try {
    const repairResponse = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { 
          role: 'system', 
          content: 'You received an invalid JSON response. Extract the scoring data and return ONLY valid JSON with this structure: {"appointmentBooked": boolean, "appointmentDetails": object|null, "rubric": {"discovery": 0-5, "objectionHandling": 0-5, "clarity": 0-5, "nextStepAsk": 0-5}, "strengths": [], "improvements": [], "betterPhrasing": []}' 
        },
        { role: 'user', content: `Fix this response to be valid JSON:\n${invalidContent}` }
      ],
      max_tokens: 1000,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(repairResponse.choices[0]?.message?.content);
  } catch (error) {
    console.error('[OpenAI] Repair attempt failed:', error);
    // Return a default response if all parsing fails
    return {
      appointmentBooked: false,
      appointmentDetails: null,
      rubric: { discovery: 3, objectionHandling: 3, clarity: 3, nextStepAsk: 3 },
      strengths: ['Completed the roleplay session'],
      improvements: ['Unable to fully analyze - please try again'],
      betterPhrasing: []
    };
  }
}

module.exports = {
  generateProspectReply,
  scoreRoleplaySession
};

