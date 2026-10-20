import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeminiCoach } from '../src/coach-gemini.ts'

const request = { scenarioId: 'cafe', baseLang: 'uz' as const, messages: [{ role: 'user' as const, text: 'I want one tea please' }], focus: [] }

function fakeFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('Gemini coach', () => {
  it('asks for JSON in the reply shape and returns the parsed reply', async () => {
    const fetch = fakeFetch(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ text: ' Sure! Hot or iced? ', translation: 'Albatta! Issiqmi yoki sovuqmi?', correction: '', better: '' }) }] }, finishReason: 'STOP' }] })
    const reply = await new GeminiCoach('k', 'gemini-test').reply(request)
    expect(reply).toEqual({ text: 'Sure! Hot or iced?', translation: 'Albatta! Issiqmi yoki sovuqmi?', correction: '', better: '' })

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k')
    expect(url).not.toContain('k=')
    const body = JSON.parse(String(init.body)) as { contents: Array<{ role: string }>; generationConfig: { responseMimeType: string; responseSchema: { required: string[] } } }
    expect(body.contents[0]?.role).toBe('user')
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema.required).toEqual(['text', 'translation', 'correction', 'better'])
  })

  it('maps assistant turns to the "model" role and opens the conversation when there is no history', async () => {
    const fetch = fakeFetch(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ text: 'Hello! What is your name?', translation: 'Salom!', correction: '', better: '' }) }] } }] })
    await new GeminiCoach('k').reply({ ...request, messages: [] })
    let body = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as { contents: Array<{ role: string; parts: Array<{ text: string }> }> }
    expect(body.contents).toHaveLength(1)
    expect(body.contents[0]?.parts[0]?.text).toContain('just arrived')

    await new GeminiCoach('k').reply({ ...request, messages: [{ role: 'assistant', text: 'Hi!' }, { role: 'user', text: 'Hello' }] })
    body = JSON.parse(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body)) as { contents: Array<{ role: string; parts: Array<{ text: string }> }> }
    expect(body.contents.map((c) => c.role)).toEqual(['model', 'user'])
  })

  it('fails loudly on a rejected key, a blocked prompt and an empty line', async () => {
    fakeFetch(403, { error: { message: 'API key not valid' } })
    await expect(new GeminiCoach('bad').reply(request)).rejects.toThrow('gemini 403')

    fakeFetch(200, { promptFeedback: { blockReason: 'SAFETY' } })
    await expect(new GeminiCoach('k').reply(request)).rejects.toThrow('refused')

    fakeFetch(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ text: '', translation: 'x', correction: '', better: '' }) }] } }] })
    await expect(new GeminiCoach('k').reply(request)).rejects.toThrow('no usable reply')
  })
})
