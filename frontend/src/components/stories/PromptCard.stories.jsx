import PromptCard from '../PromptCard'

export default {
  title: 'Quiz/PromptCard',
  component: PromptCard,
}

export const Text = {
  render: () => <PromptCard>日</PromptCard>,
}

export const RichContent = {
  render: () => (
    <PromptCard>
      <div style={{ fontSize: 48 }}>水</div>
      <div style={{ opacity: 0.6, marginTop: 8 }}>(みず)</div>
    </PromptCard>
  ),
}

export const ExtraClassName = {
  // e.g. GrammarScreen's <PromptCard className="grammar-prompt">
  render: () => <PromptCard className="grammar-prompt">文法</PromptCard>,
}