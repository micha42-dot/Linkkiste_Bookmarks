import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large contexts
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/scrape", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL is required" });
      
      const cheerio = await import('cheerio');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, nav, footer, etc to get cleaner text
      $('script, style, noscript, iframe, nav, footer, header, aside, .sidebar, #sidebar, .nav, .menu').remove();
      
      const title = $('title').text().trim() || $('h1').first().text().trim();
      let text = $('body').text().replace(/\s+/g, ' ').trim();
      
      // Limit text length to avoid token explosion
      if (text.length > 25000) text = text.substring(0, 25000) + '... (truncated)';
      
      res.json({ title, text });
    } catch (error: any) {
      console.error("Error scraping URL:", error);
      res.status(500).json({ error: error.message || "Failed to scrape URL" });
    }
  });
  app.get("/api/llm/models", async (req, res) => {
    try {
      const clientKey = (req.headers['x-ai-api-key'] || req.headers['x-openrouter-key']) as string;
      const clientBaseUrl = req.headers['x-ai-base-url'] as string;
      const baseUrl = clientBaseUrl || "https://openrouter.ai/api/v1";
      
      const apiKey = clientKey || process.env.OPENROUTER_API_KEY;
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["HTTP-Referer"] = "https://aistudio.google.com";
        headers["X-Title"] = "LinkKiste PKM";
      }

      const response = await fetch(`${baseUrl}/models`, { headers });
      if (!response.ok) throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching OpenRouter models:", error);
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  app.post("/api/llm/chat", async (req, res) => {
    const clientKey = (req.headers['x-ai-api-key'] || req.headers['x-openrouter-key']) as string;
    const clientBaseUrl = req.headers['x-ai-base-url'] as string;
    const baseUrl = clientBaseUrl || "https://openrouter.ai/api/v1";
    
    // For Ollama (localhost), an API key might not be strictly necessary, but we'll still enforce it unless baseUrl is localhost
    const apiKey = clientKey || process.env.OPENROUTER_API_KEY || (baseUrl.includes('localhost') ? 'ollama' : '');
    
    if (!apiKey) {
      return res.status(500).json({ error: "API Key is missing. Please provide it in Settings." });
    }

    const { model, prompt, context, customMessages } = req.body;

    try {
      let messages = [];
      if (customMessages) {
          messages = customMessages;
      } else {
          messages = [
            { 
                role: "system", 
                content: "You are an AI assistant integrated into a personal knowledge management tool (similar to Obsidian). Use the provided JSON context of the user's notes and bookmarks to answer their query. Be concise, insightful, and reference the specific notes by title where applicable." 
            },
            { 
                role: "user", 
                content: `Context of all my notes (JSON):\n${JSON.stringify(context)}\n\nMy Question:\n${prompt}` 
            }
          ];
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aistudio.google.com",
          "X-Title": "LinkKiste PKM",
        },
        body: JSON.stringify({
          model: model || "openai/gpt-3.5-turbo",
          messages: messages
        })
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error: ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error communicating with OpenRouter:", error);
      res.status(500).json({ error: error.message || "Failed to communicate with OpenRouter" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
