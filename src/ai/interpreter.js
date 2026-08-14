const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"
});

async function interpret(userMessage) {
  const prompt = `
You are a Discord server assistant.

Convert user message into JSON only.

Examples:

User:
change all channels into simple font and use 〢 at start

Output:
{
  "action":"rename_channels",
  "style":"simple",
  "prefix":"〢",
  "target":"channels"
}

User:
create channel

Output:
{
  "action":"create_channel"
}

User:
help

Output:
{
  "action":"help"
}

User message:
${userMessage}

Return JSON only.
`;

  const result = await model.generateContent(prompt);

  const text = result.response.text();

  try {
    return JSON.parse(
      text.replace(/```json/g, "").replace(/```/g, "").trim()
    );
  } catch {
    return {
      action: "chat",
      reply: text
    };
  }
}

module.exports = interpret;
