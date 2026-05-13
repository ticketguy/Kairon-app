/**
 * Kairon AI Worker — On-device LLM via transformers.js
 * Runs Qwen3-0.6B entirely in the browser. Zero server cost.
 * User data NEVER leaves the device.
 */
import { pipeline } from "@huggingface/transformers";

let generator = null;
let classifier = null;
let isLoading = false;

// System prompts for different features
const PROMPTS = {
  parseTask: `You are a task parser. Extract structured data from natural language.
Return ONLY valid JSON: {"title": string, "priority": "high"|"medium"|"low", "category": "Work"|"Personal"|"Shopping"|"Health"|"Other", "dueDate": "YYYY-MM-DD" or null, "tags": string[]}
If no due date mentioned, set null. Be concise.`,
  
  prioritize: `You are a productivity advisor. Given a list of tasks, suggest the optimal order.
Consider: urgency, deadlines, energy levels, and task dependencies.
Return JSON: {"order": [indices], "reasoning": string (max 50 words)}`,
  
  dailyBrief: `You are a friendly productivity assistant named Kairon.
Summarize the user's day ahead in 2-3 sentences. Be encouraging but honest.
Mention the most important task. Keep it under 60 words.`,

  timeSuggest: `Based on the task category and the user's patterns, suggest the best time.
Return JSON: {"suggestedTime": "HH:MM", "reason": string (max 20 words)}`,
};

self.onmessage = async ({ data }) => {
  const { type, payload, id } = data;

  if (type === "load") {
    if (isLoading || generator) {
      self.postMessage({ id, type: "ready", cached: true });
      return;
    }
    isLoading = true;
    try {
      // Try WebGPU first, fall back to WASM
      const hasWebGPU = typeof navigator !== "undefined" && !!navigator.gpu;
      const device = hasWebGPU ? "webgpu" : "wasm";
      const dtype = hasWebGPU ? "q4f16" : "q8";
      
      self.postMessage({ id, type: "progress", data: { status: "Loading AI model...", device } });

      generator = await pipeline("text-generation", "onnx-community/Qwen3-0.6B-ONNX", {
        device, dtype,
        progress_callback: (p) => {
          if (p.status === "download") {
            const pct = p.loaded && p.total ? Math.round(p.loaded / p.total * 100) : 0;
            self.postMessage({ id, type: "progress", data: { status: `Downloading: ${pct}%`, pct } });
          }
        }
      });
      
      self.postMessage({ id, type: "ready", device });
    } catch (e) {
      self.postMessage({ id, type: "error", error: `AI load failed: ${e.message}` });
    }
    isLoading = false;
  }

  else if (type === "parseTask") {
    if (!generator) { self.postMessage({ id, type: "error", error: "AI not loaded" }); return; }
    try {
      const output = await generator([
        { role: "system", content: PROMPTS.parseTask },
        { role: "user", content: payload.text }
      ], { max_new_tokens: 150, do_sample: false });
      const response = output[0].generated_text.at(-1).content;
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      self.postMessage({ id, type: "result", data: parsed || response });
    } catch (e) {
      self.postMessage({ id, type: "error", error: e.message });
    }
  }

  else if (type === "prioritize") {
    if (!generator) { self.postMessage({ id, type: "error", error: "AI not loaded" }); return; }
    try {
      const taskList = payload.tasks.map((t, i) => `${i+1}. ${t.title} [${t.priority}, due: ${t.dueDateTime || "none"}]`).join("\n");
      const output = await generator([
        { role: "system", content: PROMPTS.prioritize },
        { role: "user", content: taskList }
      ], { max_new_tokens: 200, do_sample: false });
      const response = output[0].generated_text.at(-1).content;
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      self.postMessage({ id, type: "result", data: jsonMatch ? JSON.parse(jsonMatch[0]) : { reasoning: response } });
    } catch (e) {
      self.postMessage({ id, type: "error", error: e.message });
    }
  }

  else if (type === "dailyBrief") {
    if (!generator) { self.postMessage({ id, type: "error", error: "AI not loaded" }); return; }
    try {
      const { tasks, completedYesterday, streak } = payload;
      const todayTasks = tasks.map(t => `- ${t.title} (${t.priority})`).join("\n");
      const prompt = `Today's tasks:\n${todayTasks}\nCompleted yesterday: ${completedYesterday}\nCurrent streak: ${streak} days`;
      const output = await generator([
        { role: "system", content: PROMPTS.dailyBrief },
        { role: "user", content: prompt }
      ], { max_new_tokens: 100, do_sample: true, temperature: 0.7 });
      self.postMessage({ id, type: "result", data: output[0].generated_text.at(-1).content });
    } catch (e) {
      self.postMessage({ id, type: "error", error: e.message });
    }
  }
};
