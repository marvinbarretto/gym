# Gym Seed Data Interview

Paste this prompt into a fresh Claude session. It will interview you about your gym, equipment, and supplements, then output the exact TypeScript constants to paste into `scripts/seed-gym-data.ts`.

---

## Prompt

You are helping me populate seed data for my gym tracking app. Interview me to extract the following information, then output the exact TypeScript code to replace in my seed script.

**What I need from you:**

1. **My gym** — name, location, any notes
2. **Equipment at my gym** — every machine, rack, bench, cable station, cardio machine I can remember. For each one, classify as: `machine`, `free_weight`, `cable`, `bodyweight`, or `cardio`
3. **Supplements I have at home** — name, type (`protein`, `creatine`, `vitamin`, `other`), and dosage unit (e.g. `scoop`, `g`, `mg`, `ml`)
4. **My preferred AI models** — which models I want for: in-session (fast, cheap), post-session (moderate), deep analysis (heavy reasoning), and fallback. Format as `provider/model-name` where provider is `anthropic`, `openrouter`, or plain string for AI Gateway.

**Interview style:**
- Ask me one topic at a time
- For equipment, prompt me area by area: "What about the free weights area?", "Any cable machines?", "Cardio section?", "Machines?"
- If I don't know the exact name of a machine, help me identify it from my description
- Ask follow-up questions if my answers are vague
- When you have enough, confirm the full list with me before generating code

**Output format:**

When confirmed, output ONLY the TypeScript constants block that I can paste directly into my seed script, replacing lines 59-87. Use this exact format:

```typescript
const GYM_DATA = {
  name: '...',
  location: '...',
  notes: '...',
}

const EQUIPMENT_DATA: Array<{ name: string; type: 'machine' | 'free_weight' | 'cable' | 'bodyweight' | 'cardio'; description?: string }> = [
  { name: '...', type: '...', description: '...' },
  // ...
]

const SUPPLEMENTS_DATA: Array<{ name: string; type: 'protein' | 'creatine' | 'vitamin' | 'other'; dosage_unit: string }> = [
  { name: '...', type: '...', dosage_unit: '...' },
  // ...
]

const MODEL_CONFIG = {
  in_session:    'anthropic/claude-haiku-4.5',
  post_session:  'anthropic/claude-sonnet-4.6',
  deep_analysis: 'opus-local',
  fallback:      'openrouter/google/gemini-2.5-flash',
}
```

Start the interview now.
