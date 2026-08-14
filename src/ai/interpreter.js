const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
}

const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash"
});

async function interpret(message) {
    const prompt = `
You are an AI Discord server assistant.

Understand the user's normal conversational request and convert it into JSON.

User request:
"${message}"

Rules:
- "channel" means Discord channels only.
- "category" means Discord categories only.
- "all channels" must NEVER include categories.
- Understand normal conversational language.
- Understand spelling mistakes.
- Do not execute anything.
- Return ONLY valid JSON.

Example:

User:
change all channel in simple font and use this first 〢 on all channels

Return:
{
  "action": "rename_channels",
  "target": "channels",
  "scope": "all",
  "prefix": "〢",
  "style": "simple"
}
`;

    const result = await model.generateContent(prompt);

    let text = result.response.text().trim();

    text = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    try {
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini returned invalid JSON:", text);
        throw new Error("Gemini returned invalid JSON.");
    }
}

module.exports = {
    interpret
};
