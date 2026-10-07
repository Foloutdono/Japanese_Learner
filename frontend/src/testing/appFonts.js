// The app's faces (main.jsx's list), for a browser test that measures
// what text lays out. Without them a test lays out in whatever the
// machine has installed — one height here, another on CI — and a pixel
// it pins moves with the fallback. Import this, then await appFonts()
// before measuring.
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/noto-serif-jp/600.css'
import '@fontsource/noto-serif-jp/700.css'
import '@fontsource/noto-serif-jp/900.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/500.css'
import '@fontsource/noto-sans-jp/700.css'

/** Every face the page has asked for, loaded. */
export async function appFonts() {
  await document.fonts.ready
}
