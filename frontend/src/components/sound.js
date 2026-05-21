export function playKana(romaji) {
  if (!romaji) return
  const audio = new Audio(`/sounds/${romaji}.mp3`)
  audio.play().catch(() => {})
}

export function speakJapanese(text) {
  if (!text) return
  window.speechSynthesis.cancel() // stop any ongoing speech
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.8
  window.speechSynthesis.speak(utterance)
}