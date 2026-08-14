const { GoogleGenAI } = require("@google/genai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({
    apiKey: apiKey
});

async function interpret(message) {
    const prompt = `
You are an AI assistant inside a Discord server.

Your job is to understand natural-language Discord management requests.

User request:
"${message}"

Return a clear JSON object describing what the user wants.

For example:

User:
"change all channel in simple font and use this first 〢"

Return:
{
  "action": "rename_channels",
  "target": "channels",
  "scope": "all",
  "prefix": "〢",
  "style": "simple"
}

Important:
- "channel" means channels, NOT categories.
- "category" means categories.
- If the user says "all channels", never include categories.
- Understand normal conversational language.
- Do not perform the action yourself.
- Return ONLY valid JSON.
`;

    const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
    });

    const text = response.text.trim();

    try {
        return JSON.parse(text);
    } catch {
        throw new Error("Gemini returned invalid JSON: " + text);
    }
}

module.exports = {
    interpret
};
