import OpenAI, { toFile } from "openai";

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[chatbot/transcribe] OPENAI_API_KEY is not set. Skipping transcription.");
    return null;
  }

  const openai = new OpenAI();

  try {
    const ext = mimeType.split("/")[1] || "ogg"; // WhatsApp typically uses ogg or aac
    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    return response.text;
  } catch (error) {
    console.error("[chatbot/transcribe] Transcription failed:", error);
    return null;
  }
}
