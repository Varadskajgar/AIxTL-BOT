const OpenAI = require("openai");
const systemPrompt = require("./systemPrompt");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function interpret(userMessage) {
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",

    instructions: systemPrompt,

    input: userMessage,

    text: {
      format: {
        type: "json_schema",
        name: "discord_action",
        strict: true,
        schema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: [
                "chat",
                "clarify",
                "rename_channels"
              ]
            },

            reply: {
              type: "string"
            },

            question: {
              type: "string"
            },

            target: {
              type: "string",
              enum: [
                "all",
                "specific"
              ]
            },

            prefix: {
              type: "string"
            },

            space_after_prefix: {
              type: "boolean"
            },

            exclude_categories: {
              type: "boolean"
            },

            style: {
              type: "string",
              enum: [
                "simple",
                "preserve"
              ]
            },

            reason: {
              type: "string"
            }
          },

          required: [
            "action",
            "reply",
            "question",
            "target",
            "prefix",
            "space_after_prefix",
            "exclude_categories",
            "style",
            "reason"
          ],

          additionalProperties: false
        }
      }
    }
  });

  return JSON.parse(response.output_text);
}

module.exports = interpret;
