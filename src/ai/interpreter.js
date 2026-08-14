const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-3.6-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0
  }
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function cleanText(text) {
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

function wordNumberToNumber(value) {
  const numbers = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100
  };

  if (!value) return null;

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return numbers[value.toLowerCase()] ?? null;
}

// --------------------------------------------------
// Local parser
// --------------------------------------------------
// This handles common commands WITHOUT Gemini.
// This is what makes the bot reliable.
// --------------------------------------------------

function parseLocally(userMessage) {
  const original = userMessage.trim();
  const text = original.toLowerCase();

  // ----------------------------------------------
  // TARGET
  // ----------------------------------------------

  let target = null;

  if (
    /\b(categories|category)\b/.test(text)
  ) {
    target = "category";
  } else if (
    /\b(channels|channel)\b/.test(text)
  ) {
    target = "channel";
  }

  // ----------------------------------------------
  // SIMPLE
  // ----------------------------------------------

  if (
    target &&
    /\b(simple|simplify|normal|clean|cleanup|clean up)\b/.test(text) &&
    (
      /\bmake\b/.test(text) ||
      /\bchange\b/.test(text) ||
      /\brename\b/.test(text) ||
      /\bconvert\b/.test(text) ||
      /\bremove\b/.test(text) ||
      /\bturn\b/.test(text)
    )
  ) {
    const all =
      /\b(all|every|each)\b/.test(text);

    const current =
      /\b(this|current)\b/.test(text);

    return {
      action: "rename_channels",
      target,
      mode: "simple",
      scope: current ? "current" : all ? "all" : "all"
    };
  }

  // ----------------------------------------------
  // PREFIX
  // ----------------------------------------------

  const prefixMatch = original.match(
    /(?:add|put|prefix)\s+(.+?)\s+(?:before|in front of)\s+(?:all\s+)?(?:the\s+)?(?:channel|channels|category|categories)/i
  );

  if (prefixMatch && target) {
    return {
      action: "rename_channels",
      target,
      mode: "prefix",
      prefix: cleanText(prefixMatch[1]),
      scope: "all"
    };
  }

  // ----------------------------------------------
  // SUFFIX
  // ----------------------------------------------

  const suffixMatch = original.match(
    /(?:add|put|suffix)\s+(.+?)\s+(?:after|at the end of)\s+(?:all\s+)?(?:the\s+)?(?:channel|channels|category|categories)/i
  );

  if (suffixMatch && target) {
    return {
      action: "rename_channels",
      target,
      mode: "suffix",
      suffix: cleanText(suffixMatch[1]),
      scope: "all"
    };
  }

  // ----------------------------------------------
  // CURRENT CHANNEL/CATEGORY REPLACE
  // ----------------------------------------------

  const currentReplace = original.match(
    /(?:change|rename|make|set)\s+(?:this|current)\s+(?:channel|category)\s+(?:name\s+)?(?:to|as|into|called)\s+(.+)/i
  );

  if (currentReplace && target) {
    return {
      action: "rename_channels",
      target,
      mode: "replace",
      name: cleanText(currentReplace[1]),
      scope: "current"
    };
  }

  // ----------------------------------------------
  // RENAME SPECIFIC OBJECT
  // Example:
  // rename general to chat
  // ----------------------------------------------

  const specificRename = original.match(
    /(?:rename|change)\s+(.+?)\s+(?:channel|category)?\s*(?:to|as|into)\s+(.+)/i
  );

  if (
    specificRename &&
    target &&
    !/\b(all|every|each|this|current)\b/.test(text)
  ) {
    return {
      action: "rename_channels",
      target,
      mode: "specific",
      oldName: cleanText(specificRename[1]),
      name: cleanText(specificRename[2]),
      scope: "named"
    };
  }

  // ----------------------------------------------
  // REPLACE ALL
  //
  // IMPORTANT:
  //
  // "change all channel name into goat"
  // "make all channels goat"
  // "rename every channel to goat"
  //
  // ALL become:
  //
  // mode = replace
  // ----------------------------------------------

  if (
    target &&
    /\b(all|every|each)\b/.test(text) &&
    (
      /\b(change|rename|make|set|turn|convert|update)\b/.test(text)
    )
  ) {
    const patterns = [
      /(?:to|into|as|called)\s+(.+)$/i,
      /(?:name|names)\s+(?:to|as|into)\s+(.+)$/i
    ];

    for (const pattern of patterns) {
      const match = original.match(pattern);

      if (match) {
        let newName = cleanText(match[1]);

        // Remove common trailing conversational words.
        newName = newName
          .replace(/\s+(please|pls|plz)$/i, "")
          .trim();

        if (newName) {
          return {
            action: "rename_channels",
            target,
            mode: "replace",
            name: newName,
            scope: "all"
          };
        }
      }
    }
  }

  // ----------------------------------------------
  // "make all channels goat"
  // ----------------------------------------------

  const makeAll = original.match(
    /(?:make|set|turn)\s+(?:all|every|each)\s+(?:the\s+)?(?:channel|channels|category|categories)\s+(.+)/i
  );

  if (makeAll && target) {
    let newName = cleanText(makeAll[1]);

    newName = newName
      .replace(/^(?:name|names)\s+/i, "")
      .replace(/^(?:to|as|into|called)\s+/i, "")
      .trim();

    if (
      newName &&
      !/^(simple|normal|clean)$/i.test(newName)
    ) {
      return {
        action: "rename_channels",
        target,
        mode: "replace",
        name: newName,
        scope: "all"
      };
    }
  }

  // ----------------------------------------------
  // DELETE CURRENT
  // ----------------------------------------------

  if (
    /\b(delete|remove|destroy)\b/.test(text) &&
    /\b(this|current)\b/.test(text) &&
    target
  ) {
    return {
      action: "delete",
      target,
      scope: "current"
    };
  }

  // ----------------------------------------------
  // DELETE ALL
  // ----------------------------------------------

  if (
    /\b(delete|remove|destroy)\b/.test(text) &&
    /\b(all|every|each)\b/.test(text) &&
    target
  ) {
    return {
      action: "delete",
      target,
      scope: "all"
    };
  }

  // ----------------------------------------------
  // DELETE NAMED
  // ----------------------------------------------

  const deleteNamed = original.match(
    /(?:delete|remove|destroy)\s+(?:the\s+)?(?:channel|category)\s+(.+)/i
  );

  if (deleteNamed && target) {
    return {
      action: "delete",
      target,
      scope: "named",
      name: cleanText(deleteNamed[1])
    };
  }

  // ----------------------------------------------
  // CREATE CATEGORY
  // ----------------------------------------------

  if (
    target === "category" &&
    /\b(create|make|add)\b/.test(text)
  ) {
    const match = original.match(
      /(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?category\s+(?:named|called|name(?:d)?|as|to)?\s*(.+)/i
    );

    if (match) {
      return {
        action: "create_categories",
        target: "category",
        count: 1,
        names: [cleanText(match[1])]
      };
    }
  }

  // ----------------------------------------------
  // CREATE CHANNELS
  // ----------------------------------------------

  if (
    /\b(create|make|add)\b/.test(text) &&
    /\b(channel|channels)\b/.test(text)
  ) {
    let count = 1;

    const countMatch = original.match(
      /(?:create|make|add)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)\s+(?:channel|channels)/i
    );

    if (countMatch) {
      count = wordNumberToNumber(countMatch[1]) || 1;
    }

    let category = null;

    const categoryMatch = original.match(
      /\b(?:in|inside|under|within)\s+(?:the\s+)?(.+?)\s+category\b/i
    );

    if (categoryMatch) {
      category = cleanText(categoryMatch[1]);
    }

    let names = [];

    const namedMatch = original.match(
      /\b(?:named|called|name(?:d)?)\s+(.+)$/i
    );

    if (namedMatch) {
      let rawNames = namedMatch[1]
        .replace(/\s+in\s+(?:the\s+)?(.+?)\s+category.*$/i, "")
        .trim();

      names = rawNames
        .split(/\s*(?:,|\band\b)\s*/i)
        .map(cleanText)
        .filter(Boolean);
    }

    if (names.length === 0) {
      names = ["new-channel"];
    }

    return {
      action: "create_channels",
      target: "channel",
      count,
      names,
      category
    };
  }

  return null;
}

// --------------------------------------------------
// Gemini fallback
// --------------------------------------------------

async function interpretWithAI(userMessage) {
  const prompt = `
You are a Discord server management intent interpreter.

Understand natural language and return ONLY valid JSON.

Possible actions:

chat
clarify
create_channels
create_categories
delete
rename_channels

Targets:

channel
category

Rename modes:

replace
prefix
suffix
simple
specific

IMPORTANT:

"change all channel name into goat"
means:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "replace",
  "name": "goat",
  "scope": "all"
}

"make all channels goat"
means the same.

"rename every channel to goat"
means the same.

"make all channels simple"
means:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "simple",
  "scope": "all"
}

"add • before all channels"
means:

{
  "action": "rename_channels",
  "target": "channel",
  "mode": "prefix",
  "prefix": "•",
  "scope": "all"
}

"delete this channel"
means:

{
  "action": "delete",
  "target": "channel",
  "scope": "current"
}

"delete this category"
means:

{
  "action": "delete",
  "target": "category",
  "scope": "current"
}

"create 30 channels named test"
means:

{
  "action": "create_channels",
  "target": "channel",
  "count": 30,
  "names": ["test"],
  "category": null
}

"create 5 channels in announcement category named channel1, channel2, channel3"
means:

{
  "action": "create_channels",
  "target": "channel",
  "count": 5,
  "names": ["channel1", "channel2", "channel3"],
  "category": "announcement"
}

Rules:

- channel means channel only.
- category means category only.
- all channels never includes categories.
- all categories never includes channels.
- replace replaces the complete name.
- prefix adds before the existing name.
- suffix adds after the existing name.
- simple removes decorative styling while preserving the meaningful name.
- Understand imperfect grammar.
- Return JSON only.

User:
${userMessage}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("AI interpreter error:", error);

    return {
      action: "clarify",
      question: "I couldn't understand that. What would you like me to do?"
    };
  }
}

// --------------------------------------------------
// Main interpreter
// --------------------------------------------------

async function interpret(userMessage) {
  // First use deterministic local parsing.
  // This handles common commands reliably.
  const localResult = parseLocally(userMessage);

  if (localResult) {
    console.log("🧠 Local interpretation:", localResult);
    return localResult;
  }

  // If local parser cannot understand it,
  // use Gemini for natural conversation.
  const aiResult = await interpretWithAI(userMessage);

  console.log("🤖 AI interpretation:", aiResult);

  return aiResult;
}

module.exports = interpret;
