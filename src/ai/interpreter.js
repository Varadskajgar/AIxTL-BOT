const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3.6-flash"
});

async function interpret(userMessage) {
  const prompt = `
You are an AI command interpreter for a Discord server.

Your job is to understand the user's request and return ONLY valid JSON.

The bot can perform these actions:

1. Normal chat
2. Create channels
3. Create categories
4. Delete channels
5. Delete categories
6. Rename channels
7. Rename categories
8. Create multiple channels
9. Create multiple categories
10. Rename multiple channels
11. Rename multiple categories
12. Make channel/category names simple

==================================================
IMPORTANT CHANNEL / CATEGORY RULES
==================================================

A CHANNEL and a CATEGORY are completely different.

If the user says "channel":
- ONLY target channels.
- NEVER target categories.

If the user says "category":
- ONLY target categories.
- NEVER target channels.

If the user says "all channels":
- target channels only.

If the user says "all categories":
- target categories only.

If the user says "this channel":
- target the current channel only.

If the user says "this category":
- target the current category only.

Never silently change the target type.

==================================================
NORMAL CHAT
==================================================

For normal conversation:

{
  "action": "chat",
  "reply": "your response"
}

==================================================
CLARIFICATION
==================================================

If the request is ambiguous and you cannot safely determine what the
user wants:

{
  "action": "clarify",
  "question": "your question"
}

==================================================
CREATE CHANNEL
==================================================

User:
"create a channel named rules"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 1,
  "names": ["rules"],
  "category": null
}

==================================================
CREATE MULTIPLE CHANNELS
==================================================

User:
"create 3 channels named chat, memes and gaming"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 3,
  "names": ["chat", "memes", "gaming"],
  "category": null
}

==================================================
CREATE MANY CHANNELS WITH ONE NAME
==================================================

User:
"create 30 channels named test"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 30,
  "names": ["test"],
  "category": null
}

The execution code can repeat the supplied name when count is greater
than the number of names.

==================================================
CREATE CHANNELS INSIDE CATEGORY
==================================================

User:
"create 5 channels in announcement category named channel1, channel2, channel3"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 5,
  "names": ["channel1", "channel2", "channel3"],
  "category": "announcement"
}

IMPORTANT:
"announcement" is the parent category.

The bot must CREATE CHANNELS inside that category.

It must NOT create a category.

==================================================
CREATE CATEGORY
==================================================

User:
"create a category named events"

Return:

{
  "action": "create_categories",
  "target": "category",
  "count": 1,
  "names": ["events"]
}

==================================================
CREATE MULTIPLE CATEGORIES
==================================================

User:
"create 3 categories named events, giveaway and support"

Return:

{
  "action": "create_categories",
  "target": "category",
  "count": 3,
  "names": ["events", "giveaway", "support"]
}

==================================================
DELETE CURRENT CHANNEL
==================================================

User:
"delete this channel"

Return:

{
  "action": "delete",
  "target": "channel",
  "scope": "current"
}

IMPORTANT:
This means ONLY the current channel.

NEVER delete the category.

==================================================
DELETE NAMED CHANNEL
==================================================

User:
"delete channel general"

Return:

{
  "action": "delete",
  "target": "channel",
  "scope": "named",
  "name": "general"
}

==================================================
DELETE ALL CHANNELS
==================================================

User:
"delete all channels"

Return:

{
  "action": "delete",
  "target": "channel",
  "scope": "all"
}

==================================================
DELETE CURRENT CATEGORY
==================================================

User:
"delete this category"

Return:

{
  "action": "delete",
  "target": "category",
  "scope": "current"
}

IMPORTANT:
This means ONLY the current category.

NEVER delete channels unless the execution code specifically handles
children as part of Discord's category deletion behavior.

==================================================
DELETE NAMED CATEGORY
==================================================

User:
"delete category announcement"

Return:

{
  "action": "delete",
  "target": "category",
  "scope": "named",
  "name": "announcement"
}

==================================================
DELETE ALL CATEGORIES
==================================================

User:
"delete all categories"

Return:

{
  "action": "delete",
  "target": "category",
  "scope": "all"
}

==================================================
RENAME CHANNELS - PREFIX MODE
==================================================

User:
"add • before all channel names"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "prefix",
  "prefix": "•"
}

Example:

general → •general
rules → •rules
support → •support

==================================================
RENAME CHANNELS - REPLACE MODE
==================================================

User:
"make all channel names Happy...!!!"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "replace",
  "name": "Happy...!!!"
}

Example:

general → Happy...!!!
rules → Happy...!!!
support → Happy...!!!

IMPORTANT:
This is NOT prefix mode.

Every targeted channel gets exactly the requested name.

==================================================
MAKE CHANNEL NAMES SIMPLE
==================================================

If the user says:

"make all channel names simple"

OR:

"make channels simple"

OR:

"remove style from channel names"

OR:

"remove symbols from channel names"

OR:

"remove styling from all channels"

OR:

"convert all channel names to simple"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "simple"
}

IMPORTANT:

Simple mode means:

- Keep the meaningful/original channel name.
- Remove decorative emojis.
- Remove decorative prefixes.
- Remove decorative suffixes.
- Remove brackets used only for styling.
- Remove bullets and separators used only for styling.
- Do NOT replace the name with a completely new name.

Examples:

"「💬」general" → "general"

"〢・rules" → "rules"

"╰・support" → "support"

"🎮・gaming" → "gaming"

"💬┃general-chat" → "general-chat"

The actual cleaning is performed by the channel action handler.

==================================================
MAKE CATEGORY NAMES SIMPLE
==================================================

If the user specifically says:

"make all category names simple"

Return:

{
  "action": "rename_channels",
  "target": "category",
  "mode": "simple"
}

IMPORTANT:
Only categories are affected.

Channels must NOT be changed.

==================================================
RENAME SPECIFIC CHANNEL
==================================================

User:
"rename general to chat"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "specific",
  "oldName": "general",
  "name": "chat"
}

==================================================
RENAME SPECIFIC CATEGORY
==================================================

User:
"rename announcement category to news"

Return:

{
  "action": "rename_channels",
  "target": "category",
  "mode": "specific",
  "oldName": "announcement",
  "name": "news"
}

==================================================
RENAME ALL CATEGORIES
==================================================

User:
"rename all categories to Happy"

Return:

{
  "action": "rename_channels",
  "target": "category",
  "mode": "replace",
  "name": "Happy"
}

==================================================
PREFIX ALL CATEGORIES
==================================================

User:
"add • before all category names"

Return:

{
  "action": "rename_channels",
  "target": "category",
  "mode": "prefix",
  "prefix": "•"
}

==================================================
AMBIGUOUS DELETE
==================================================

User:
"delete it"

If there is no context telling you whether it is a channel or category:

{
  "action": "clarify",
  "question": "Do you want me to delete a channel or a category?"
}

==================================================
AMBIGUOUS RENAME
==================================================

User:
"rename everything"

If it is unclear whether the user means channels or categories:

{
  "action": "clarify",
  "question": "Do you want to rename channels or categories?"
}

==================================================
IMPORTANT SAFETY RULES FOR INTERPRETATION
==================================================

- Never invent channel names.
- Never invent category names.
- Never convert "channel" into "category".
- Never convert "category" into "channel".
- "in announcement category" means create channels inside announcement.
- "channel in category" does NOT mean create another category.
- "all channels" means channels only.
- "all categories" means categories only.
- "this channel" means current channel.
- "this category" means current category.
- "simple" means remove decorative styling while preserving the meaningful name.
- "replace" means replace the complete name.
- "prefix" means add something before the existing name.
- Specific rename means rename only the specified object.

==================================================
OUTPUT FORMAT
==================================================

Return ONLY valid JSON.

Never return Markdown.

Never use code fences.

Never explain the JSON.

Never add text before or after the JSON.

Use double quotes for JSON strings.

The JSON must contain the correct action.

For create_channels:
- target must be "channel"
- count must be a number
- names must be an array
- category must be a category name or null

For create_categories:
- target must be "category"
- count must be a number
- names must be an array

For delete:
- target must be "channel" or "category"
- scope must be "current", "named", or "all"

For rename_channels:
- target must be "channel" or "category"
- mode must be "prefix", "replace", "specific", or "simple"

User message:
${userMessage}
`;

  try {
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
  } catch (error) {
    console.error("❌ Gemini API error:");
    console.error(error);

    return {
      action: "chat",
      reply: "Sorry, I couldn't process that request."
    };
  }
}

module.exports = interpret;
