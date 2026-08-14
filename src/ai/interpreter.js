const { GoogleGenerativeAI } = require("@google/generative-ai");

async function interpret(message) {
  // ==========================================
  // CHECK GEMINI API KEY
  // ==========================================

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  // ==========================================
  // GEMINI
  // ==========================================

  const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
  );

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash"
  });

  // ==========================================
  // AI INSTRUCTIONS
  // ==========================================

  const prompt = `
You are an AI assistant for a Discord server.

The user will give you a Discord request.

You MUST return ONLY valid JSON.
Do NOT use markdown.
Do NOT add explanations outside the JSON.

Available actions:

1. Normal conversation:
{
  "action": "chat",
  "reply": "your response"
}

2. Need more information:
{
  "action": "clarify",
  "question": "what you need to ask"
}

3. Rename Discord channels:
{
  "action": "rename_channels",
  "prefix": "•",
  "space_after_prefix": false,
  "exclude_categories": true
}

Rules for rename_channels:

- If the user says "add • before channel name", use:
  "prefix": "•"

- If the user says "add this (•) first before channel name", use:
  "prefix": "•"

- If the user says "add • before every channel", use:
  "prefix": "•"

- If the user asks for simple channel names AND asks to add • before them, preserve the existing channel names and only add the prefix.

- "space_after_prefix" should normally be false unless the user specifically asks for a space.

- "exclude_categories" should normally be true.

Examples:

User:
"hello"

Return:
{
  "action": "chat",
  "reply": "Hello! 👋"
}

User:
"help"

Return:
{
  "action": "chat",
  "reply": "Sure! Tell me what you need help with."
}

User:
"change all channel name into simple style and add this (•) first before channel name"

Return:
{
  "action": "rename_channels",
  "prefix": "•",
  "space_after_prefix": false,
  "exclude_categories": true
}

User:
"put • before all channels"

Return:
{
  "action": "rename_channels",
  "prefix": "•",
  "space_after_prefix": false,
  "exclude_categories": true
}

User:
"rename all channels"

Return:
{
  "action": "clarify",
  "question": "What style or prefix should I use for the channel names?"
}

IMPORTANT:
Return JSON only.

User request:
${message}
`;

  // ==========================================
  // SEND REQUEST TO GEMINI
  // ==========================================

  const result = await model.generateContent(prompt);

  let text = result.response.text().trim();

  // ==========================================
  // REMOVE MARKDOWN CODE BLOCKS
  // ==========================================

  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // ==========================================
  // PARSE JSON
  // ==========================================

  let action;

  try {
    action = JSON.parse(text);
  } catch (error) {
    console.error("❌ Gemini returned invalid JSON:");
    console.error(text);

    return {
      action: "chat",
      reply: text || "Sorry, I couldn't understand that."
    };
  }

  // ==========================================
  // VALIDATE ACTION
  // ==========================================

  if (!action || typeof action !== "object") {
    return {
      action: "chat",
      reply: "Sorry, I couldn't understand that."
    };
  }

  if (!action.action) {
    return {
      action: "chat",
      reply: action.reply || "I'm here."
    };
  }

  // ==========================================
  // RETURN ACTION
  // ==========================================

  return action;
}

// ==========================================
// EXPORT
// ==========================================

module.exports = interpret;
