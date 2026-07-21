// ── quizModes.js — data debug view ─────────────────────────
// Not a component — kanaModes / kanaModePicker / vocabKanjiModes /
// kanjiModes / vocabKanjiStatsLabels are the single source of truth
// for every mode key/label KanaScreen, VocabScreen, KanjiScreen and
// StatsScreen all read from. This just renders their actual output as
// a plain list so a wrong key or a missing-translation fallback is
// visible without spinning up all four screens.
//
// t={} below exercises every single `t.xxx ?? '...'` fallback in the
// file — the same French text a real user would see before that
// translation key existed — since nothing here is actually filled in.
import {
  KANA_MODE_KEYS, VOCAB_MODE_KEYS, KANJI_MODE_KEYS,
  kanaModes, kanaModePicker, vocabKanjiModes, kanjiModes, vocabKanjiStatsLabels,
} from '../quizModes'

const t = {}

function List({ title, rows }) {
  return (
    <div style={{ marginBottom: 24, fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ opacity: 0.85 }}>{JSON.stringify(r)}</div>
      ))}
    </div>
  )
}

export default {
  title: 'Data/quizModes',
}

export const AllModeLists = {
  render: () => (
    <div>
      <List title="KANA_MODE_KEYS" rows={[KANA_MODE_KEYS]} />
      <List title="VOCAB_MODE_KEYS" rows={[VOCAB_MODE_KEYS]} />
      <List title="KANJI_MODE_KEYS" rows={[KANJI_MODE_KEYS]} />
      <List title="kanaModes(t)" rows={kanaModes(t)} />
      <List title="kanaModePicker(t)" rows={kanaModePicker(t)} />
      <List title="vocabKanjiModes(t, 'mot')" rows={vocabKanjiModes(t, 'mot')} />
      <List title="kanjiModes(t)" rows={kanjiModes(t)} />
      <List title="vocabKanjiStatsLabels('mot')" rows={vocabKanjiStatsLabels('mot')} />
    </div>
  ),
}