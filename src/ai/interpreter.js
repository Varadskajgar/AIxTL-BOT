const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3.6-flash"
});

/*
==========================================================
AI DISCORD COMMAND INTERPRETER
==========================================================

IMPORTANT:

This file ONLY understands the user's intent.

It returns structured JSON.

The actual Discord operation must be handled by
channelActions.js.

==========================================================
*/

async function interpret(userMessage) {
  const prompt = `
You are the INTENT ENGINE for a Discord management bot.

Understand the user's NATURAL LANGUAGE.

The user does NOT need to use formal commands.

Examples:

"change all channel name into goat"
"make all channels goat"
"rename every channel to goat"
"bro change channels to goat"
"can you make all channel names goat"

All mean:

Rename ALL CHANNELS and replace their complete names with:

"goat"

Your job is to understand WHAT THE USER MEANS, not just match exact
phrases.

==========================================================
ABSOLUTE RULE
==========================================================

Return ONLY valid JSON.

No Markdown.
No code fences.
No explanation.
No comments.
No text before or after JSON.

==========================================================
AVAILABLE ACTIONS
==========================================================

chat
clarify
create_channels
create_categories
delete
rename_channels

==========================================================
TARGET TYPES
==========================================================

There are only two target types:

"channel"
"category"

CHANNEL and CATEGORY are completely different.

If the user says:

channel
channels
channel name
channel names
all channels
every channel
this channel

=> target = "channel"

If the user says:

category
categories
category name
category names
all categories
every category
this category

=> target = "category"

NEVER convert channel into category.

NEVER convert category into channel.

==========================================================
NATURAL LANGUAGE UNDERSTANDING
==========================================================

Understand:

"change"
"rename"
"make"
"set"
"turn"
"convert"
"update"

as possible rename operations when the context indicates names.

Understand:

"all"
"every"
"each"

as a request to affect all matching objects.

Understand informal grammar.

For example:

"change all channel name into goat"

means:

"Rename all channel names to goat."

Do NOT reject the request because the grammar is imperfect.

==========================================================
RENAME: REPLACE MODE
==========================================================

If the user provides a NEW NAME and wants existing names changed to it,
use:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "replace",
  "name": "NEW NAME",
  "scope": "all"
}

Examples:

User:
"change all channel name into goat"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "replace",
  "name": "goat",
  "scope": "all"
}

User:
"make every channel goat"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "replace",
  "name": "goat",
  "scope": "all"
}

User:
"rename all channels to Happy...!!!"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "replace",
  "name": "Happy...!!!",
  "scope": "all"
}

User:
"change all category names to events"

Return:

{
  "action": "rename_channels",
  "target": "category",
  "mode": "replace",
  "name": "events",
  "scope": "all"
}

IMPORTANT:

"replace" means the COMPLETE existing name is replaced.

Example:

general -> goat
rules -> goat
support -> goat

Do NOT add the new name before or after the old name.

==========================================================
RENAME: PREFIX MODE
==========================================================

Use prefix mode ONLY when the user wants something added BEFORE the
existing name.

Examples:

"add • before all channels"

"put • in front of every channel"

"prefix all channel names with #"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "prefix",
  "prefix": "•",
  "scope": "all"
}

Example:

general -> •general
rules -> •rules

IMPORTANT:

If the user says:

"make all channels goat"

this is NOT prefix mode.

It is REPLACE mode.

==========================================================
RENAME: SUFFIX MODE
==========================================================

If the user explicitly wants something added AFTER the existing name:

"add -old at the end of every channel"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "suffix",
  "suffix": "-old",
  "scope": "all"
}

Do NOT use suffix mode unless the user clearly asks for something at
the end.

==========================================================
RENAME: SIMPLE MODE
==========================================================

If the user wants existing styled names cleaned up:

"make all channels simple"
"make channel names normal"
"remove styling from channels"
"remove emojis from channel names"
"remove symbols from channels"
"clean channel names"
"remove decorations"
"make channel names clean"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "simple",
  "scope": "all"
}

Example:

"🎮・gaming" -> "gaming"

"「💬」general" -> "general"

"〢・rules" -> "rules"

IMPORTANT:

Simple mode does NOT assign a new name.

It keeps the meaningful name and removes decorative styling.

==========================================================
RENAME: SPECIFIC OBJECT
==========================================================

User:

"rename general to chat"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "specific",
  "oldName": "general",
  "name": "chat",
  "scope": "named"
}

User:

"rename announcement category to news"

Return:

{
  "action": "rename_channels",
  "target": "category",
  "mode": "specific",
  "oldName": "announcement",
  "name": "news",
  "scope": "named"
}

==========================================================
CURRENT CHANNEL
==========================================================

If user says:

"rename this channel to goat"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "replace",
  "name": "goat",
  "scope": "current"
}

If user says:

"make this channel simple"

Return:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "simple",
  "scope": "current"
}

==========================================================
CURRENT CATEGORY
==========================================================

If user says:

"rename this category to events"

Return:

{
  "action": "rename_channels",
  "target": "category",
  "mode": "replace",
  "name": "events",
  "scope": "current"
}

==========================================================
CREATE CHANNELS
==========================================================

User:

"create a channel called rules"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 1,
  "names": ["rules"],
  "category": null
}

==========================================================
CREATE MULTIPLE CHANNELS
==========================================================

User:

"create 3 channels called general memes gaming"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 3,
  "names": ["general", "memes", "gaming"],
  "category": null
}

Also understand:

"make 5 channels named test"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 5,
  "names": ["test"],
  "category": null
}

If count is larger than the number of supplied names,
the execution layer may repeat the names.

==========================================================
CREATE CHANNELS INSIDE CATEGORY
==========================================================

User:

"create 5 channels in announcement category named
channel1 channel2 channel3"

Return:

{
  "action": "create_channels",
  "target": "channel",
  "count": 5,
  "names": [
    "channel1",
    "channel2",
    "channel3"
  ],
  "category": "announcement"
}

IMPORTANT:

"inside announcement category"

means:

CREATE CHANNELS

with parent category:

announcement

Do NOT create a category called announcement.

==========================================================
CREATE CATEGORY
==========================================================

User:

"create a category called events"

Return:

{
  "action": "create_categories",
  "target": "category",
  "count": 1,
  "names": ["events"]
}

==========================================================
CREATE MULTIPLE CATEGORIES
==========================================================

User:

"create 3 categories events giveaway support"

Return:

{
  "action": "create_categories",
  "target": "category",
  "count": 3,
  "names": [
    "events",
    "giveaway",
    "support"
  ]
}

==========================================================
DELETE CURRENT CHANNEL
==========================================================

User:

"delete this channel"

Return:

{
  "action": "delete",
  "target": "channel",
  "scope": "current"
}

==========================================================
DELETE NAMED CHANNEL
==========================================================

User:

"delete channel general"

Return:

{
  "action": "delete",
  "target": "channel",
  "scope": "named",
  "name": "general"
}

==========================================================
DELETE ALL CHANNELS
==========================================================

User:

"delete all channels"

Return:

{
  "action": "delete",
  "target": "channel",
  "scope": "all"
}

==========================================================
DELETE CURRENT CATEGORY
==========================================================

User:

"delete this category"

Return:

{
  "action": "delete",
  "target": "category",
  "scope": "current"
}

==========================================================
DELETE NAMED CATEGORY
==========================================================

User:

"delete announcement category"

Return:

{
  "action": "delete",
  "target": "category",
  "scope": "named",
  "name": "announcement"
}

==========================================================
DELETE ALL CATEGORIES
==========================================================

User:

"delete all categories"

Return:

{
  "action": "delete",
  "target": "category",
  "scope": "all"
}

==========================================================
AMBIGUOUS REQUESTS
==========================================================

If the user says:

"delete it"

and you cannot determine whether "it" means a channel or category:

{
  "action": "clarify",
  "question": "Do you want me to delete a channel or a category?"
}

If the user says:

"rename everything"

and there is no information about whether they mean channels or categories:

{
  "action": "clarify",
  "question": "Do you want to rename channels or categories?"
}

==========================================================
IMPORTANT DIFFERENCE
==========================================================

These are DIFFERENT:

"add goat before all channels"

=> prefix

"add goat after all channels"

=> suffix

"make all channels goat"

=> replace

"change all channel names to goat"

=> replace

"rename every channel as goat"

=> replace

"make all channel names simple"

=> simple

Do NOT confuse these modes.

==========================================================
MORE NATURAL EXAMPLES
==========================================================

"bro change all channels into goat"

=> replace all channels with goat.

"now make every channel goat"

=> replace all channels with goat.

"all channel names should be Happy"

=> replace all channels with Happy.

"change channel name to test"

If the user is clearly referring to ALL channels in context:

=> replace all channels with test.

If there is no indication of all/current/specific and it is ambiguous,
ask for clarification.

"put • before channels"

=> prefix all channels with •.

"remove the • from channels"

=> simple/clean styling from channels.

"make my channels normal"

=> simple all channels.

"clean up all category names"

=> simple all categories.

==========================================================
NUMBER HANDLING
==========================================================

Understand numbers naturally:

"make 10 channels"
"create ten channels"
"create 30 channels"

Convert word numbers into numeric count when possible.

==========================================================
CASE
==========================================================

Preserve the user's requested replacement name exactly as much as
possible.

Example:

"make all channels Happy...!!!"

name should be:

"Happy...!!!"

Do not automatically lowercase it.

==========================================================
FINAL JSON RULES
==========================================================

Valid actions:

"chat"
"clarify"
"create_channels"
"create_categories"
"delete"
"rename_channels"

Valid targets:

"channel"
"category"

Valid rename modes:

"replace"
"prefix"
"suffix"
"simple"
"specific"

Valid delete scopes:

"current"
"named"
"all"

Valid create fields:

count = number
names = array
category = category name or null

Never invent missing information.

Never add Markdown.

Never add explanations.

Return ONLY JSON.

USER MESSAGE:
${userMessage}
`;

  try {
    const result = await model.generateContent(prompt);

    const text = result.response.text().trim();

    try {
      return JSON.parse(text);
    } catch (parseError) {
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
      reply: "Sorry, I couldn't understand that request."
    };
  }
}

module.exports = interpret;
