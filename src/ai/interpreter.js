const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
}

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash"
});

async function interpret(userMessage) {

    const prompt = `
You are an intelligent Discord server assistant.

Your job is to understand normal human language and convert it into a JSON action.

IMPORTANT RULES:

1. Understand natural language.
2. Do not require the user to use a specific command format.
3. "channel" means Discord channels.
4. "category" means Discord categories.
5. NEVER change categories when the user says channels.
6. If the user says "all channels", target all text/voice/forum/stage channels that can be renamed.
7. Preserve the user's requested prefix exactly.
8. If the user asks for a font/style, understand what they mean.
9. Do not execute anything. Only return the instruction as JSON.
10. Return ONLY valid JSON. No markdown. No explanation.

SUPPORTED ACTIONS:

rename_channels
create_channel
delete_channel
help
chat
clarify

EXAMPLE 1:

User:
change all channels in simple font and use this first 〢

JSON:
{
  "action": "rename_channels",
  "target": "channels",
  "scope": "all",
  "style": "simple",
  "prefix": "〢"
}

EXAMPLE 2:

User:
rename every channel with 〢 before the name

JSON:
{
  "action": "rename_channels",
  "target": "channels",
  "scope": "all",
  "style": "simple",
  "prefix": "〢"
}

EXAMPLE 3:

User:
change all channel names to simple style and put 〢 at the beginning

JSON:
{
  "action": "rename_channels",
  "target": "channels",
  "scope": "all",
  "style": "simple",
  "prefix": "〢"
}

EXAMPLE 4:

User:
create a channel called announcements

JSON:
{
  "action": "create_channel",
  "name": "announcements"
}

EXAMPLE 5:

User:
help

JSON:
{
  "action": "help"
}

EXAMPLE 6:

User:
hello

JSON:
{
  "action": "chat",
  "reply": "Hello! What would you like me to do?"
}

If you are unsure what the user wants:

{
  "action": "clarify",
  "question": "Please tell me what you want me to change."
}

USER MESSAGE:

${userMessage}
`;

    const result = await model.generateContent(prompt);

    const response = result.response;
    const text = response.text().trim();

    console.log("🤖 Gemini response:", text);

    try {

        const cleaned = text
            .replace(/^```json/i, "")
            .replace(/^```/i, "")
            .replace(/```$/i, "")
            .trim();

        return JSON.parse(cleaned);

    } catch (error) {

        console.error("❌ Gemini returned invalid JSON:");
        console.error(text);

        return {
            action: "clarify",
            question: "I understood part of your request, but I couldn't determine the exact action."
        };
    }
}

module.exports = interpret;
