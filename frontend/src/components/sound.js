export function playKana(romaji) {
  if (!romaji) return
  const audio = new Audio(`/sounds/${romaji}.mp3`)
  audio.play().catch(() => {})
}

export async function speakJapanese(text) {
  window.speechSynthesis.cancel()
  try {
    // Try Puter (good quality)
    const audio = await window.puter.ai.txt2speech(text, {
      lang: "ja-JP"
    });
    audio.play();
  } catch {
    // Fallback to browser TTS
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    speechSynthesis.speak(utterance);
  }
}