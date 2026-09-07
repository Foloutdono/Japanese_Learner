import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The icon set the manifest (vite.config.js) and index.html name, cut
// from brand/icon.png (see brand/icon.html). The 2023 minimal preset —
// 64/192/512 transparent, a 512 maskable, a 180 apple touch icon and
// the favicon — with the sumi panel as the ground everywhere a
// platform pads the image, instead of the preset's white.
const sumi = '#100e13'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: sumi } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: sumi } },
  },
  images: ['brand/icon.png'],
})
