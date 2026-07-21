import SelectionScreen from '../SelectionScreen'

export default {
  title: 'Layout/SelectionScreen',
  component: SelectionScreen,
}

export const HeaderlessWithChild = {
  // The common case: LevelSelector/ModeSelector already render their
  // own header, so SelectionScreen is left bare on purpose.
  render: () => (
    <SelectionScreen>
      <div style={{ opacity: 0.6, textAlign: 'center', padding: 40 }}>
        (enfant quelconque — LevelSelector/ModeSelector ici en usage réel)
      </div>
    </SelectionScreen>
  ),
}

export const WithOwnHeader = {
  render: () => (
    <SelectionScreen eyebrow="JLPT" heading="Choisis ton niveau" subtitle="Tu pourras changer plus tard">
      <div style={{ opacity: 0.6, textAlign: 'center', padding: 40 }}>(contenu)</div>
    </SelectionScreen>
  ),
}

export const NarrowMaxWidth = {
  render: () => (
    <SelectionScreen heading="Colonne plus étroite" maxWidth={420}>
      <div style={{ opacity: 0.6, textAlign: 'center', padding: 40 }}>(contenu)</div>
    </SelectionScreen>
  ),
}