const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const model = genAI
  ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  : null;

function localInterpret(text) {
  const s = String(text || "").trim();
  const l = s.toLowerCase();

  // Undo
  if (/^(undo|undo that|restore (the )?previous|make it as (it was|before))\b/i.test(s)) {
    return { action: "undo" };
  }

  // DELETE
  if (/\bdelete\b/i.test(s)) {
    const target = /\b(categor(?:y|ies)|category)\b/i.test(s) ? "category" : "channel";
    let scope = /\b(all|every|each)\b/i.test(s) ? "all" : "current";
    let name;

    const m = s.match(/\b(?:channel|category)\s+["']?([^"']+?)["']?\s*$/i);
    if (m && !/\b(this|that|all|every)\b/i.test(m[1])) {
      name = m[1].trim();
      scope = "named";
    }

    return {
      action: "delete",
      target,
      scope,
      ...(name ? { name } : {})
    };
  }

  // CREATE
  if (/\bcreate\b|\bmake\b.*\bnew\b/i.test(s) && /\bchannel\b|\bcategory\b/i.test(s)) {
    const target = /\bcategory\b/i.test(s) ? "category" : "channel";
    const countMatch = s.match(/\b(\d{1,3})\b/);
    const count = countMatch ? Math.min(Number(countMatch[1]), 100) : 1;

    let names = [];
    const named = s.match(/\bnamed?\s+(.+)$/i);
    if (named) {
      names = named[1]
        .replace(/\s+in\s+(?:the\s+)?category\b.*$/i, "")
        .split(/,\s*|\s+and\s+/i)
        .map(x => x.trim())
        .filter(Boolean);
    }

    if (!names.length) {
      const quoted = [...s.matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
      names = quoted;
    }

    const categoryMatch = s.match(/\bin\s+(?:the\s+)?category\s+["']?([^"']+?)["']?(?:\s+named\b|$)/i);
    return {
      action: "create",
      target,
      count,
      names: names.length ? names : ["new-channel"],
      category: categoryMatch ? categoryMatch[1].trim() : null
    };
  }

  // RENAME - explicit "rename"
  if (/\brename\b/i.test(s)) {
    const target = /\bcategory\b/i.test(s) ? "category" : "channel";

    if (/\b(all|every|each)\b/i.test(s)) {
      const after = s.match(/\bto\s+(.+)$/i);
      if (after) {
        return {
          action: "rename",
          target,
          scope: "all",
          mode: "replace",
          name: after[1].trim().replace(/^["']|["']$/g, "")
        };
      }
      if (/\bsimple\b/i.test(s)) {
        return { action: "rename", target, scope: "all", mode: "simple" };
      }
    }

    const current = /\b(this|current)\b/i.test(s);
    if (current) {
      const after = s.match(/\bto\s+(.+)$/i);
      if (after) {
        return {
          action: "rename",
          target,
          scope: "current",
          mode: "replace",
          name: after[1].trim().replace(/^["']|["']$/g, "")
        };
      }
    }

    const m = s.match(/^rename\s+(?:the\s+)?(?:channel|category)\s+(.+?)\s+to\s+(.+)$/i);
    if (m) {
      return {
        action: "rename",
        target,
        scope: "named",
        oldName: m[1].trim().replace(/^["']|["']$/g, ""),
        mode: "replace",
        name: m[2].trim().replace(/^["']|["']$/g, "")
      };
    }
  }

  // SIMPLE channel/category requests
  if (/\bsimple\b/i.test(s) && /\bchannel(s)?\b/i.test(s)) {
    return { action: "rename", target: "channel", scope: "all", mode: "simple" };
  }

  if (/\bsimple\b/i.test(s) && /\bcategor(y|ies)\b/i.test(s)) {
    return { action: "rename", target: "category", scope: "all", mode: "simple" };
  }

  // "make all channels goat", "make all channels X"
  const makeAll = s.match(/^(?:make|change)\s+(?:all|every)\s+(channels?|categories?)\s+(?:to\s+|into\s+)?(.+)$/i);
  if (makeAll) {
    const target = /^categories?$/i.test(makeAll[2]) ? "category" : (/categories?/i.test(makeAll[1]) ? "category" : "channel");
    const value = makeAll[2].trim().replace(/^["']|["']$/g, "");

    if (/\bsimple\b/i.test(value)) {
      return { action: "rename", target, scope: "all", mode: "simple" };
    }

    return { action: "rename", target, scope: "all", mode: "replace", name: value };
  }

  return null;
}

async function interpret(userMessage) {
  const local = localInterpret(userMessage);
  if (local) {
    console.log("🧠 Local interpretation:", local);
    return local;
  }

  if (!model) {
    return {
      action: "chat",
      reply: "⚠️ GEMINI_API_KEY is not configured, so I can only process Discord management commands."
    };
  }

  const prompt = `
You are the command interpreter for a Discord server management bot.

Return ONLY valid JSON. No markdown.

Allowed actions:
"chat", "rename", "create", "delete", "undo", "clarify"

For rename:
{
  "action":"rename",
  "target":"channel|category",
  "scope":"current|named|all",
  "mode":"simple|replace|prefix",
  "name":"new name",
  "oldName":"old name",
  "prefix":"prefix",
  "space":true
}

For create:
{
  "action":"create",
  "target":"channel|category",
  "count":1,
  "names":["name"],
  "category":null
}

For delete:
{
  "action":"delete",
  "target":"channel|category",
  "scope":"current|named|all",
  "name":"name"
}

For undo:
{"action":"undo"}

Examples:
"make all channels simple text" -> {"action":"rename","target":"channel","scope":"all","mode":"simple"}
"make all channels goat" -> {"action":"rename","target":"channel","scope":"all","mode":"replace","name":"goat"}
"rename general to chat" -> {"action":"rename","target":"channel","scope":"named","oldName":"general","mode":"replace","name":"chat"}
"rename this channel to gaming" -> {"action":"rename","target":"channel","scope":"current","mode":"replace","name":"gaming"}
"rename all categories to events" -> {"action":"rename","target":"category","scope":"all","mode":"replace","name":"events"}
"delete this channel" -> {"action":"delete","target":"channel","scope":"current"}
"undo" -> {"action":"undo"}

User message:
${userMessage}
`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error("❌ Gemini interpreter error:", error);

    return {
      action: "chat",
      reply: "❌ I couldn't understand that command."
    };
  }
}

module.exports = interpret;
