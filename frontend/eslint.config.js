import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// The native projects (plan 076) carry a copy of the built bundle under
// android/app/src/main/assets/public and ios/App/App/public -- minified
// output, git-ignored, and not this lint's business. So is the landing
// page's voices.js: the app's recipes, bundled and minified by
// `npm run landing` (landing/build.mjs), and linted as the recipes.
export default defineConfig([globalIgnores(['dist', 'dist-native', 'android', 'ios', 'public/landing/voices.js']), {
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
}, {
  // vitest-browser-react's unmount() and rerender() are async, each a
  // React act(): one left un-awaited is still open when the next test
  // renders, and that render never commits -- a failure in whichever
  // test runs next, never in the one that caused it (Guide and
  // GrammarWork, 2026-10-25).
  files: ['src/**/*.{browser,phone,tablet,touch,desktop,wide,short}.test.{js,jsx}'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: 'ExpressionStatement > CallExpression[callee.property.name=/^(unmount|rerender)$/]',
      message: 'unmount() and rerender() are async in vitest-browser-react: await them, or the next test renders into an open act().',
    }],
  },
}])
