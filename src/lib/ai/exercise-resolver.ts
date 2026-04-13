// src/lib/ai/exercise-resolver.ts

interface Exercise {
  id: string
  name: string
}

type ResolveResult =
  | { match: 'exact'; exercise: Exercise }
  | { match: 'fuzzy'; exercise: Exercise }
  | { match: 'ambiguous'; candidates: Exercise[] }
  | { match: 'none' }

export function resolveExercise(query: string, exercises: Exercise[]): ResolveResult {
  const q = query.toLowerCase().trim()

  // 1. Exact match (case-insensitive)
  const exact = exercises.find(e => e.name.toLowerCase() === q)
  if (exact) return { match: 'exact', exercise: exact }

  // 2. Fuzzy: exercise name contains all words from query
  const words = q.split(/\s+/)
  const fuzzy = exercises.filter(e => {
    const name = e.name.toLowerCase()
    return words.every(w => name.includes(w))
  })

  if (fuzzy.length === 1) return { match: 'fuzzy', exercise: fuzzy[0] }
  if (fuzzy.length > 1) return { match: 'ambiguous', candidates: fuzzy }

  // 3. Looser: any word from query appears in exercise name
  const loose = exercises.filter(e => {
    const name = e.name.toLowerCase()
    return words.some(w => name.includes(w))
  })

  if (loose.length === 1) return { match: 'fuzzy', exercise: loose[0] }
  if (loose.length > 1) return { match: 'ambiguous', candidates: loose }

  return { match: 'none' }
}
