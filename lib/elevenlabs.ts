// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs API integration for Text-to-Speech
// ─────────────────────────────────────────────────────────────────────────────

export async function generateAudioFromText(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  // Default to a known voice ID if not provided, though it's best to configure it.
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    console.warn("[elevenlabs] Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID. Skipping TTS.");
    return null;
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        // Optional voice settings for Hazem (you can tweak these)
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[elevenlabs] API Error:", JSON.stringify(err));
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("[elevenlabs] Network error during TTS:", error);
    return null;
  }
}
