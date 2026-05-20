export function playKana(romaji) {
  if (!romaji) return
  // some romaji map to different file names
  const fileMap = {
    'shi': 'shi',
    'chi': 'chi',
    'tsu': 'tsu',
    'fu':  'fu',
  }
  const filename = fileMap[romaji] ?? romaji
  const audio = new Audio(`/sounds/${filename}.mp3`)
  audio.play().catch(() => {})  // catch if browser blocks autoplay
}