// src/lib/ai/response-parser.ts

export interface SetData {
  reps?: number
  weight_kg?: number
  rpe?: number
  duration_s?: number
  notes?: string
}

export type ParsedEntry =
  | { type: 'log_sets'; exercise: string; sets: SetData[] }
  | { type: 'log_cardio'; exercise: string; duration_min: number; distance_km?: number; notes?: string }

interface ParseResult {
  entries: ParsedEntry[]
  message: string
}

export function parseAiResponse(text: string): ParseResult {
  const entries: ParsedEntry[] = []
  let message = text

  // Try to extract JSON from code fences first
  const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g
  let fenceMatch: RegExpExecArray | null
  const fenceMatches: string[] = []

  while ((fenceMatch = fenceRegex.exec(text)) !== null) {
    fenceMatches.push(fenceMatch[1].trim())
    message = message.replace(fenceMatch[0], '').trim()
  }

  // If no fences found, try to parse the whole text as JSON
  if (fenceMatches.length === 0) {
    const trimmed = text.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      fenceMatches.push(trimmed)
      message = ''
    }
  }

  for (const raw of fenceMatches) {
    try {
      const parsed = JSON.parse(raw)
      const items = Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        if (item.type === 'log_sets' && item.exercise && Array.isArray(item.sets)) {
          entries.push({
            type: 'log_sets',
            exercise: item.exercise,
            sets: item.sets,
          })
        } else if (item.type === 'log_cardio' && item.exercise && typeof item.duration_min === 'number') {
          entries.push({
            type: 'log_cardio',
            exercise: item.exercise,
            duration_min: item.duration_min,
            distance_km: item.distance_km,
            notes: item.notes,
          })
        } else if (item.type === 'clarify' && item.message) {
          // clarify type: surface the message, don't create an entry
          message = item.message
        } else if (item.type === 'chat' && item.message) {
          message = item.message
        }
      }
    } catch {
      // Malformed JSON — ignore this block, keep message as-is
    }
  }

  return { entries, message: message.trim() }
}
