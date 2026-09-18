import { describe, expect, it } from 'vitest'
import { collectProperNouns, levenshtein, matchText, normalize, tokenize } from '../text'

describe('normalize', () => {
  it('lower-cases, strips punctuation and collapses spaces', () => {
    expect(normalize('  Hello,   my FRIEND! ', 'en')).toBe('hello my friend')
  })
  it('expands English contractions so both forms grade the same', () => {
    expect(normalize("I'm happy", 'en')).toBe(normalize('I am happy', 'en'))
    expect(normalize("I can't", 'en')).toBe(normalize('I cannot', 'en'))
    expect(normalize('It’s okay', 'en')).toBe('it is okay')
  })
  it('unifies apostrophe variants used in Uzbek', () => {
    expect(normalize('Yo‘q, do`stim', 'uz')).toBe(normalize("yo'q do'stim", 'uz'))
  })
  it('treats ё as е in Russian', () => {
    expect(normalize('У меня всё отлично', 'ru')).toBe(normalize('у меня все отлично', 'ru'))
  })
  it('handles Turkish dotted and dotless i', () => {
    expect(normalize('İYİ', 'tr')).toBe('iyi')
    expect(normalize('ILIK', 'tr')).toBe('ılık')
  })
})

describe('tokenize', () => {
  it('drops edge punctuation and lower-cases the first tile', () => {
    expect(tokenize('Good morning, my friend!', 'en')).toEqual(['good', 'morning', 'my', 'friend'])
  })
  it('keeps "I" and listed proper nouns capitalised', () => {
    expect(tokenize("I'm from London.", 'en', new Set(['London']))).toEqual(["I'm", 'from', 'London'])
    expect(tokenize('Anna is my friend.', 'en', new Set(['Anna']))).toEqual(['Anna', 'is', 'my', 'friend'])
  })
  it('keeps inner apostrophes', () => {
    expect(tokenize("Salom, do'stim!", 'uz')).toEqual(['salom', "do'stim"])
  })
})

describe('collectProperNouns', () => {
  it('finds capitalised words that are not sentence-initial', () => {
    const nouns = collectProperNouns(['I live in London.', 'Hello! How are you?', 'This is Anna.'])
    expect([...nouns].sort()).toEqual(['Anna', 'London'])
  })
})

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
  })
})

describe('matchText', () => {
  it('accepts exact answers regardless of case and punctuation', () => {
    expect(matchText('how are you', 'How are you?', 'en')).toEqual({ correct: true, typo: false })
  })
  it('accepts a small typo in a longer word', () => {
    expect(matchText('Good mornng', 'Good morning', 'en')).toEqual({ correct: true, typo: true })
  })
  it('rejects typos in short words', () => {
    expect(matchText('I em happy', 'I am happy', 'en').correct).toBe(false)
  })
  it('rejects a different real word even if it is one edit away', () => {
    const lexicon = new Set(['tired', 'tried'])
    expect(matchText('I am tried', 'I am tired', 'en', lexicon).correct).toBe(false)
  })
  it('rejects wrong word count and empty input', () => {
    expect(matchText('I happy', 'I am happy', 'en').correct).toBe(false)
    expect(matchText('', 'Hello', 'en').correct).toBe(false)
  })
})
