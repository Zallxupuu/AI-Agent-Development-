import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Message } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

const SYSTEM_INSTRUCTION = `Kamu adalah asisten CS AI yang gaul, asik, ramah, dan sangat membantu.
1. Gunakan bahasa sehari-hari yang santai (seperti "aku", "kamu", "kak", "bro", dll) tapi tetap sopan.
2. Jangan kaku atau terlalu formal. Tambahkan emoji sesekali biar asik.
3. Jawab singkat, padat, dan jelas (maksimal 1-2 paragraf pendek).
4. Kalau tidak tahu, bilang saja dengan santai. Jangan bahas topik aneh/sensitif.`;

export async function getGeminiResponse(
  chatHistory: Message[],
  latestMessage: string
): Promise<string> {
  try {
    const formattedHistory = chatHistory.map((msg) => ({
      role: msg.role === "client" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: `[System Instruction]: ${SYSTEM_INSTRUCTION}` }] },
        { role: "model", parts: [{ text: "Baik, saya siap." }] },
        ...formattedHistory,
      ],
    });

    const result = await chat.sendMessage(latestMessage);
    const text = result.response.text();

    if (!text || text.trim().length === 0) return "Maaf, saya tidak dapat memproses.";
    return text;
  } catch (error) {
    console.error("[Gemini Error]:", error);
    return "Maaf, terjadi gangguan sistem. Tunggu admin kami.";
  }
}
