// server/ai.js — AI chat endpoint (OpenAI-compatible)
import fetch from "node-fetch";

export function setupAI(app) {
  app.post("/api/ai/chat", async (req, res) => {
    const apiKey = process.env.AI_API_KEY;
    const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return res.status(503).json({ error: "AI service not configured. Set AI_API_KEY env var." });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array required." });
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI API error:", errText);
        return res.status(502).json({ error: "AI service returned an error." });
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "No response.";
      res.json({ reply });
    } catch (err) {
      console.error("AI request failed:", err);
      res.status(500).json({ error: "Failed to reach AI service." });
    }
  });
}
