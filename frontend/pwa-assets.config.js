import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The icon set the manifest (vite.config.js) and index.html name, cut
// from brand/icon.png (rendered from brand/icon.svg). The 2023 minimal preset —
// 64/192/512 transparent, a 512 maskable, a 180 apple touch icon and
// the favicon — with the sumi panel as the ground everywhere a
// platform pads the image, instead of the preset's white.
//
// The maskable and apple icons take no padding (plan 203): icon.svg
// already holds the mark inside the maskable safe zone, and the preset's
// 0.3 shrank it a second time, to 41% of the icon.
const sumi = '#100e13'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: sumi } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: sumi } },
  },
  images: ['brand/icon.png'],
})
