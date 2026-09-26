import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { inline, readUse, prepare } from './lessonText'

// ── 文法 — a lesson's text, read for its shape (plan 145) ───────────
// What a reader meets: the Japanese in the prose marked (and a formula
// kept whole), French punctuation and a sentence's opening term welded
// to their words, a use line as its saying over its forms, a paradigm
// as labels beside forms -- and any line that reads neither way left as
// prose. The last block runs the parser over the whole catalogue: no
// reshaped line may lose a character of its Japanese.

const NBSP = ' '
const ja = pieces => pieces.filter(p => p.ja).map(p => p.text)

describe('inline', () => {
  it('marks the Japanese runs and keeps a formula whole', () => {
    const pieces = inline("**です** relie un nom en な à ce qu'il est : A は B です, A est B.")
    expect(ja(pieces)).toEqual(['です', 'な', `A${NBSP}は${NBSP}B${NBSP}です`])
    expect(pieces[0]).toEqual({ text: 'です', strong: true, ja: true })
    // A lone placeholder is not Japanese: "A est B" stays prose.
    expect(pieces.at(-1).text).toBe(', A est B.')
  })

  it('welds French punctuation and a term that opens a sentence', () => {
    const text = prepare('A est B. **だ** est le même mot ; en langue polie, pour « il y a », c\'est です')
    expect(text).toContain(`**だ**${NBSP}est`)
    expect(text).toContain(`mot${NBSP};`)
    expect(text).toContain(`«${NBSP}il${NBSP}y${NBSP}a${NBSP}»`)
  })

  it('leaves English and a long quotation as they were', () => {
    expect(prepare('A **polite request**: do this.')).toBe('A **polite request**: do this.')
    expect(prepare('« un très long passage cité ici »')).toBe(`«${NBSP}un très long passage cité ici${NBSP}»`)
  })
})

describe('readUse', () => {
  it('reads "saying : forms" in either language', () => {
    expect(readUse('Pour poser ce dont on parle : わたしは, 今日は, この本は.')).toEqual({
      say: 'Pour poser ce dont on parle',
      forms: [{ ja: 'わたしは', gloss: null }, { ja: '今日は', gloss: null }, { ja: 'この本は', gloss: null }],
    })
    expect(readUse('Company: 父と行きます (with my father).')).toEqual({
      say: 'Company', forms: [{ ja: '父と行きます', gloss: 'with my father' }],
    })
  })

  it('keeps a comma inside a gloss, and reads "ou" and a slash as separators', () => {
    expect(readUse('Others of the family: いただく (eat, receive), うかがう (visit, ask).').forms).toEqual([
      { ja: 'いただく', gloss: 'eat, receive' }, { ja: 'うかがう', gloss: 'visit, ask' },
    ])
    expect(readUse('Équivalent parlé : か, ou それか／それとも.').forms.map(f => f.ja)).toEqual(['か', 'それか／それとも'])
    expect(readUse('Negative: 大きくないです / きれいではありません.').forms.map(f => f.ja))
      .toEqual(['大きくないです', 'きれいではありません'])
  })

  it('reads a paradigm as labels beside forms', () => {
    expect(readUse("Négatif : ではありません (à l'oral じゃありません). Passé : でした. Passé négatif : ではありませんでした.")).toEqual({
      table: [
        { label: 'Négatif', forms: [{ ja: 'ではありません', gloss: "à l'oral じゃありません" }] },
        { label: 'Passé', forms: [{ ja: 'でした', gloss: null }] },
        { label: 'Passé négatif', forms: [{ ja: 'ではありませんでした', gloss: null }] },
      ],
    })
  })

  it('never splits at a colon inside a gloss', () => {
    expect(readUse('Negative: ではありません (spoken: じゃありません). Past: でした.').table.map(r => r.label))
      .toEqual(['Negative', 'Past'])
  })

  it('leaves a line that reads neither way as prose', () => {
    expect(readUse('Essais.')).toBeNull()
    expect(readUse('Often with どうも, やや, 少し.')).toBeNull()
    expect(readUse('食べる, 飲む, 読む : la chose mangée, bue, lue… prend を.')).toBeNull()
    expect(readUse('Négatif : ce que dit la phrase.')).toBeNull()
  })
})

describe('the catalogue', () => {
  const JA_CHARS = /[々぀-ヿ㐀-鿿]/g
  const lines = []
  for (const level of ['N5', 'N4', 'N3', 'N2', 'N1']) {
    const url = new URL(`../../../../backend/content/grammar/${level}.json`, import.meta.url)
    for (const point of JSON.parse(readFileSync(fileURLToPath(url), 'utf8'))) {
      for (const step of point.steps ?? []) {
        if (step.kind !== 'use') continue
        for (const lang of ['fr', 'en']) {
          for (const line of step[lang].split('\n')) lines.push(line.replace(/^- /, ''))
        }
      }
    }
  }

  it('reshapes nine use lines in ten, and loses no Japanese doing it', () => {
    let shaped = 0
    const lost = []
    for (const line of lines) {
      const shape = readUse(line)
      if (!shape) continue
      shaped++
      const rows = shape.table ?? [{ label: shape.say, forms: shape.forms }]
      const printed = rows.map(r => r.label + r.forms.map(f => f.ja + (f.gloss ?? '')).join('')).join('')
      if (printed.match(JA_CHARS)?.join('') !== line.match(JA_CHARS)?.join('')) lost.push(line)
    }
    expect(lost).toEqual([])
    expect(shaped / lines.length).toBeGreaterThan(0.9)
  })
})
