import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type { import('@storybook/react-vite').StorybookConfig } */
export default {
  stories: ['../src/**/*.stories.@(js|jsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // your app proxies /api to localhost:8000 in vite.config.js — Storybook
  // doesn't need that for XpToast (no API calls), so no server.proxy here
}