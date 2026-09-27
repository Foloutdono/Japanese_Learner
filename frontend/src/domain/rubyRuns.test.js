import { describe, it, expect } from 'vitest'
import { joinRuns } from './rubyRuns'

describe('joinRuns', () => {
  it('joins a run of kanji under one reading and leaves the rest as it is', () => {
    expect(joinRuns([
      { text: 'か（' }, { text: '間', reading: 'かん' }, { text: '接', reading: 'せつ' }, { text: '疑', reading: 'ぎ' },
      { text: '問', reading: 'もん' }, { text: '） + ' }, { text: '知', reading: 'し' }, { text: 'っている' },
    ])).toEqual([
      { text: 'か（' }, { text: '間接疑問', reading: 'かんせつぎもん' }, { text: '） + ' },
      { text: '知', reading: 'し' }, { text: 'っている' },
    ])
  })

  it('is nothing for nothing', () => {
    expect(joinRuns(undefined)).toEqual([])
    expect(joinRuns([{ text: 'verb + から' }])).toEqual([{ text: 'verb + から' }])
  })
})
