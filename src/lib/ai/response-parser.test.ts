// src/lib/ai/response-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseAiResponse, type ParsedEntry } from './response-parser'

describe('parseAiResponse', () => {
  it('extracts log_sets from JSON block', () => {
    const text = 'Logged your chest press.\n```json\n{"type":"log_sets","exercise":"Chest Press Machine","sets":[{"reps":10,"weight_kg":40},{"reps":10,"weight_kg":40},{"reps":10,"weight_kg":40}]}\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toEqual({
      type: 'log_sets',
      exercise: 'Chest Press Machine',
      sets: [
        { reps: 10, weight_kg: 40 },
        { reps: 10, weight_kg: 40 },
        { reps: 10, weight_kg: 40 },
      ],
    })
    expect(result.message).toBe('Logged your chest press.')
  })

  it('extracts log_cardio', () => {
    const text = '```json\n{"type":"log_cardio","exercise":"Treadmill Run","duration_min":30,"distance_km":5}\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toEqual({
      type: 'log_cardio',
      exercise: 'Treadmill Run',
      duration_min: 30,
      distance_km: 5,
    })
  })

  it('extracts chat-only response (no JSON)', () => {
    const text = 'How did that feel? Sounded heavy.'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(0)
    expect(result.message).toBe('How did that feel? Sounded heavy.')
  })

  it('extracts multiple entries from array', () => {
    const text = '```json\n[{"type":"log_sets","exercise":"Bench Press","sets":[{"reps":8,"weight_kg":60}]},{"type":"log_cardio","exercise":"Treadmill Run","duration_min":10}]\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(2)
  })

  it('handles malformed JSON gracefully', () => {
    const text = '```json\n{broken json\n```\nHere is some text.'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(0)
    expect(result.message).toContain('Here is some text')
  })

  it('extracts JSON without code fence (bare JSON in response)', () => {
    const text = '{"type":"log_sets","exercise":"Lat Pulldown","sets":[{"reps":12,"weight_kg":30}]}'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].exercise).toBe('Lat Pulldown')
  })

  it('handles clarify type', () => {
    const text = '```json\n{"type":"clarify","message":"Which machine — chest press or pec deck?"}\n```'
    const result = parseAiResponse(text)
    expect(result.entries).toHaveLength(0)
    expect(result.message).toBe('Which machine — chest press or pec deck?')
  })
})
