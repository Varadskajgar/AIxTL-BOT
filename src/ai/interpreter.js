const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3.6-flash"
});

async function interpret(userMessage) {
  const prompt = `
You are an AI assistant for a Discord server.

The user can ask you to:
1. Chat normally
2. Rename Discord channels

Return ONLY valid JSON.

For normal conversation:
{
  "action": "chat",
  "reply": "your response"
}

If the user wants to rename channels:
{
  "action": "rename_channels",
  "style": "simple",
  "prefix": "•"
}

If you need more information:
{
  "action": "clarify",
  "question": "your question"
}

Important:
- Never return Markdown.
- Never use code fences.
- Return JSON only.
- For channel renaming, understand requests such as:
  "change all channel names into simple style and add • first"
  "rename channels"
  "put • before every channel"
  "make channel names simple"

User message:
${userMessage}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("❌ Gemini returned invalid JSON:");
    console.error(text);

    return {
      action: "chat",
      reply: text
    };
  }
}

module.exports = interpret;
