import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// The native projects (plan 076) carry a copy of the built bundle under
// android/app/src/main/assets/public and ios/App/App/public -- minified
// output, git-ignored, and not this lint's business.
export default defineConfig([globalIgnores(['dist', 'dist-native', 'android', 'ios']), {
  files: ['**/*.{js,jsx}'],
  extends: [
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    globals: globals.browser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
}])
