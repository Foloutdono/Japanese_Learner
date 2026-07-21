import '../src/index.css'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../src/LangContext'

export const globalTypes = {
  theme: {
    description: 'Theme',
    toolbar: {
      title: 'Theme',
      icon: 'circlehollow',
      items: [
        { value: 'dark', title: 'Dark (sumi)' },
        { value: 'light', title: 'Light (washi)' },
      ],
      dynamicTitle: true,
    },
  },
}

export const initialGlobals = { theme: 'dark' }

/** @type { import('@storybook/react-vite').Preview } */
export default {
  decorators: [
    (Story, context) => {
      document.documentElement.setAttribute('data-theme', context.globals.theme)
      return (
        <LangProvider>
          <MemoryRouter>
            <div style={{ background: 'var(--bg-main)', minHeight: '100vh', padding: 40 }}>
              <Story />
            </div>
          </MemoryRouter>
        </LangProvider>
      )
    },
  ],
}