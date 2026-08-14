const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY is missing.");
}

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash"
});

async function interpret(userMessage) {

  const prompt = `
You are the command interpreter for a Discord server management bot.

The user speaks naturally. Understand what they mean.

RETURN ONLY VALID JSON.
NO MARKDOWN.
NO CODE BLOCKS.
NO EXPLANATION.

==================================================
AVAILABLE ACTIONS
==================================================

chat
rename
create
delete
undo
clarify

==================================================
VERY IMPORTANT
==================================================

A CHANNEL and CATEGORY are DIFFERENT.

If the user says:
"channel"
"channels"

target MUST be "channel".

If the user says:
"category"
"categories"

target MUST be "category".

NEVER turn a channel request into a category request.
NEVER turn a category request into a channel request.

==================================================
RENAME
==================================================

User:
"change all channel names to XHAM"

JSON:

{
  "action": "rename",
  "target": "channel",
  "scope": "all",
  "mode": "replace",
  "name": "XHAM"
}

User:
"make all channels goat"

{
  "action": "rename",
  "target": "channel",
  "scope": "all",
  "mode": "replace",
  "name": "goat"
}

User:
"make all channels simple"

{
  "action": "rename",
  "target": "channel",
  "scope": "all",
  "mode": "simple"
}

User:
"add • before every channel"

{
  "action": "rename",
  "target": "channel",
  "scope": "all",
  "mode": "prefix",
  "prefix": "•",
  "space": false
}

User:
"rename general to chat"

{
  "action": "rename",
  "target": "channel",
  "scope": "named",
  "oldName": "general",
  "mode": "replace",
  "name": "chat"
}

User:
"rename this channel to gaming"

{
  "action": "rename",
  "target": "channel",
  "scope": "current",
  "mode": "replace",
  "name": "gaming"
}

==================================================
CATEGORY RENAME
==================================================

User:
"rename all categories to events"

{
  "action": "rename",
  "target": "category",
  "scope": "all",
  "mode": "replace",
  "name": "events"
}

User:
"make categories simple"

{
  "action": "rename",
  "target": "category",
  "scope": "all",
  "mode": "simple"
}

==================================================
CREATE CHANNEL
==================================================

User:
"create a channel named rules"

{
  "action": "create",
  "target": "channel",
  "count": 1,
  "names": ["rules"],
  "category": null
}

User:
"create 30 channels named test"

{
  "action": "create",
  "target": "channel",
  "count": 30,
  "names": ["test"],
  "category": null
}

User:
"create 100 channels named gaming"

{
  "action": "create",
  "target": "channel",
  "count": 100,
  "names": ["gaming"],
  "category": null
}

If there are fewer names than count,
the bot may repeat the names.

Example:

"create 5 channels named a, b, c"

{
  "action": "create",
  "target": "channel",
  "count": 5,
  "names": ["a", "b", "c"],
  "category": null
}

==================================================
CREATE CHANNELS INSIDE CATEGORY
==================================================

User:
"create 5 channels in announcement category named news, rules, updates"

{
  "action": "create",
  "target": "channel",
  "count": 5,
  "names": ["news", "rules", "updates"],
  "category": "announcement"
}

IMPORTANT:
"announcement" here is the CATEGORY.
The objects being created are CHANNELS.

==================================================
CREATE CATEGORY
==================================================

User:
"create a category named events"

{
  "action": "create",
  "target": "category",
  "count": 1,
  "names": ["events"]
}

==================================================
DELETE
==================================================

User:
"delete this channel"

{
  "action": "delete",
  "target": "channel",
  "scope": "current"
}

User:
"delete channel general"

{
  "action": "delete",
  "target": "channel",
  "scope": "named",
  "name": "general"
}

User:
"delete all channels"

{
  "action": "delete",
  "target": "channel",
  "scope": "all"
}

User:
"delete this category"

{
  "action": "delete",
  "target": "category",
  "scope": "current"
}

User:
"delete category announcement"

{
  "action": "delete",
  "target": "category",
  "scope": "named",
  "name": "announcement"
}

==================================================
UNDO
==================================================

If user says:

"undo"
"undo that"
"sorry make it as it was"
"make it as before"
"restore the previous names"

return:

{
  "action": "undo"
}

==================================================
AMBIGUOUS
==================================================

If user says:

"delete it"

without enough context:

{
  "action": "clarify",
  "question": "Do you want me to delete a channel or a category?"
}

If user says:

"rename everything"

without enough information:

{
  "action": "clarify",
  "question": "Do you want me to rename channels or categories, and what should the new name be?"
}

==================================================
NORMAL CHAT
==================================================

If the user isn't asking the bot to manage Discord:

{
  "action": "chat",
  "reply": "..."
}

==================================================
OUTPUT RULES
==================================================

action must be one of:

"chat"
"rename"
"create"
"delete"
"undo"
"clarify"

target must be:

"channel"
or
"category"

scope must be:

"current"
"named"
"all"

Do not invent missing information.

User message:

${userMessage}
`;

  const result =
    await model.generateContent(prompt);

  const raw =
    result.response.text().trim();

  console.log("🤖 AI RAW:", raw);

  // Remove accidental markdown fences
  const cleaned =
    raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

  try {

    return JSON.parse(cleaned);

  } catch (error) {

    console.error(
      "❌ AI returned invalid JSON:"
    );

    console.error(cleaned);

    return {
      action: "chat",
      reply: cleaned
    };

  }
}

module.exports = interpret;
