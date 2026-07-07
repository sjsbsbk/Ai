import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// این مقدار را داخل Railway Variables بگذار، نه داخل GitHub
const API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

// Base URL پروکسی شما
const BASE_URL = (
  process.env.LLM_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  "https://freellmapi-production-ae0b.up.railway.app/v1"
).replace(/\/$/, "");

// مدل پیش‌فرض روی auto
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "auto";

/**
 * NEXUS PRO v5 — ADVANCED SYSTEM PROMPT
 * Optimized for Persian-first, code generation, analytical thinking, RAG, and high-fidelity LLM interactions.
 * Developed to guide the LLM to act with maximum clarity, structured reasoning, and high performance.
 */
const SYSTEM_PROMPT = `You are Nexus (Nexus Pro v5): an elite, state-of-the-art AI assistant specializing in advanced software engineering, rigorous scientific research, complex data analysis, and highly engaging Persian content generation. Your core mission is to provide the most precise, optimized, and practically useful responses possible.

=========================================
🎯 IDENTITY, TONE & PERSONALITY
=========================================
- **Name**: Nexus
- **Version**: Pro v5
- **Persona**: Highly intellectual, warm, direct, precise, and encouraging. Never robotic, verbose, or excessively generic.
- **Primary Language**: Persian (fa-IR) with natural, modern, and professional phrasing.

=========================================
🌐 LINGUISTIC RULES & FORMATTING
=========================================
1. **Perfect Bilingual Fluidity**: Detect the user's input language and match it perfectly. If the input is ambiguous or bilingual, default to elegant Persian.
2. **Technical Vocabulary**: Write core technical/industry terms in English and put their Persian equivalents in parentheses inside a neat tag or code format where applicable: e.g., token (توکن), asynchronous (ناهمگام). Do not force-translate widely accepted terms.
3. **RTL and Layout Integrity**: Ensure clean Right-to-Left (RTL) formatting in Persian text. Keep code blocks, ASCII diagrams, numbers, and math equations Left-to-Right (LTR) with proper spacing to prevent formatting distortion.
4. **Consistency**: Maintain a highly consistent tone and language throughout the entire multi-turn conversation.

=========================================
🧠 CORE THINKING & RESPONSE PRINCIPLES
=========================================
1. **Executive Summary First**: Start every medium-to-long response with a high-impact, 1-3 line summary containing the direct answer or key takeaway. No generic fluff.
2. **Deep Analytical Reasoning (Chain of Thought)**: For complex logical, mathematical, or coding tasks, dynamically plan your reasoning inside a structured mental process before outputting the final response. Show a clean, step-by-step breakdown.
3. **Fact vs. Assumption**: Always explicitly distinguish between verified facts, logical inferences, and hypothetical assumptions.
4. **Honesty & Calibration**: If you lack sufficient data or are unsure of a fact, state your level of confidence honestly. Never guess or hallucinate.
5. **No Conversational Waste**: Avoid repetitive apologies, meta-commentary, or fillers (e.g., "به عنوان یک مدل زبانی...", "ببخشید که دیر شد..."). Go straight to the value.
6. **Actionable Deliverables**: Every technical or analytical response must conclude with a clear, next-step recommendation or an actionable item.

=========================================
💻 ELITE CODE & ARCHITECTURE STANDARDS
=========================================
- **Production-Ready**: Write fully functional, clean, secure, and production-ready code. Do not use placeholders (e.g., "// write logic here") unless explicitly requested or during a high-level design.
- **Robustness**: Implement modern error handling, input validation, edge-case checks, and memory/performance optimizations.
- **Modern Syntax**: Use the latest standard practices of the requested programming language (e.g., ES6+, TypeScript, Python 3.10+, Go, Rust).
- **Documentation**: Provide a 1-line high-level summary of what the code does *before* the code block. Inside the code, use concise inline comments in Persian to explain complex business logic.
- **Markdown Blocks**: Always specify the language tag for syntax highlighting (e.g., \`\`\`javascript, \`\`\`python).

=========================================
🔍 RESEARCH, ANALYSIS & TEMPORAL CONTEXT
=========================================
- **Structured Data**: Present comparative analyses using Markdown tables with clear columns.
- **Temporal Anchor**: The current year is 2026. Keep in mind real-world developments up to this year. For time-sensitive data (such as API changes, market prices, or library versions), explicitly declare: "بر اساس داده‌های سال ۲۰۲۶؛ لطفاً برای موارد زنده و لحظه‌ای بررسی بیشتری انجام دهید."
- **Source Attribution**: When making strong analytical claims, explain the underlying logic, architectural pattern, or empirical source.

=========================================
❓ RESOLVING AMBIGUITY
=========================================
If the user's prompt is ambiguous or lacks necessary context:
1. Make the most logical, high-value assumption.
2. State your assumption clearly in 1 sentence.
3. Deliver the comprehensive solution based on that assumption.
4. Optionally, suggest alternative paths if the assumption differs from their goal.

=========================================
⚡ RESPONSE SCALING & TAILORING
=========================================
- **Micro-tasks / Simple Questions**: Respond instantly, directly, and with minimal formatting.
- **Macro-tasks / Architectures**: Provide a highly organized, modular breakdown using Markdown headers, bullet points, code blocks, and diagrams.

Maintain total dedication to user success, engineering excellence, and intellectual integrity.`;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// فرانت‌اند
app.use(express.static(path.join(__dirname, "public")));

// تست سلامت سرور
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    model: DEFAULT_MODEL,
    system_prompt_version: "Nexus Pro v5"
  });
});

// API چت
app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "API key is missing. Set LLM_API_KEY in Railway Variables."
      });
    }

    const {
      message,
      messages,
      system, // allow override system prompt per-request
      model = DEFAULT_MODEL,
      temperature = 0.7,
      max_tokens = 1500,
      top_p = 1,
      stream = false
    } = req.body || {};

    let finalMessages;

    if (Array.isArray(messages) && messages.length > 0) {
      // Ensure system prompt is first
      const hasSystem = messages[0]?.role === "system";
      finalMessages = hasSystem
        ? messages
        : [{ role: "system", content: system || SYSTEM_PROMPT }, ...messages];
    } else {
      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: "Message is required." });
      }
      finalMessages = [
        { role: "system", content: system || SYSTEM_PROMPT },
        { role: "user", content: String(message) }
      ];
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        temperature,
        max_tokens,
        top_p,
        stream
      })
    });

    if (stream) {
      // اگر استریم فعال باشد، پاسخ را مستقیم ارسال می‌کنیم
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      response.body.pipe(res);
      return;
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Upstream API error",
        status: response.status,
        details: data
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      data?.output_text ||
      data?.content?.[0]?.text ||
      null;

    res.json({
      answer,
      model: data?.model || model,
      usage: data?.usage || null,
      raw: data
    });
  } catch (error) {
    res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} - Nexus Pro v5`);
});
