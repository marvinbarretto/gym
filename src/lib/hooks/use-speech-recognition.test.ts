import { describe, it, expect } from 'vitest'
import {
  createSpeechController,
  getRecognitionCtor,
  type RecognitionEvent,
  type RecognitionLike,
  type SpeechState,
} from './use-speech-recognition'

function buildFakeRecognition() {
  const instances: FakeRecognition[] = []
  class FakeRecognition implements RecognitionLike {
    continuous = true
    interimResults = false
    lang = ''
    onresult: ((e: RecognitionEvent) => void) | null = null
    onerror: (() => void) | null = null
    onend: (() => void) | null = null
    started = false
    constructor() {
      instances.push(this)
    }
    start() {
      this.started = true
    }
    stop() {
      this.onend?.()
    }
    say(...parts: string[]) {
      this.onresult?.({ results: parts.map((p) => ({ 0: { transcript: p }, length: 1 })) })
    }
  }
  return { Ctor: FakeRecognition, instances }
}

function buildController() {
  const { Ctor, instances } = buildFakeRecognition()
  const states: SpeechState[] = []
  const ended: string[] = []
  const controller = createSpeechController(Ctor, {
    onChange: (s) => states.push(s),
    onEnd: (t) => ended.push(t),
  })
  return { controller, instances, states, ended }
}

describe('createSpeechController', () => {
  it('streams interim transcript updates', () => {
    const { controller, instances, states } = buildController()
    controller.start()
    expect(instances[0].started).toBe(true)
    expect(instances[0].interimResults).toBe(true)
    instances[0].say('bench')
    instances[0].say('bench press', ' three sets')
    expect(states.at(-2)).toEqual({ listening: true, transcript: 'bench' })
    expect(states.at(-1)).toEqual({ listening: true, transcript: 'bench press three sets' })
  })

  it('stop ends the session and reports the final transcript once', () => {
    const { controller, instances, states, ended } = buildController()
    controller.start()
    instances[0].say('squats 5x5')
    controller.stop()
    expect(states.at(-1)).toEqual({ listening: false, transcript: 'squats 5x5' })
    expect(ended).toEqual(['squats 5x5'])
  })

  it('ignores a second start while listening', () => {
    const { controller, instances } = buildController()
    controller.start()
    controller.start()
    expect(instances).toHaveLength(1)
  })
})

describe('getRecognitionCtor', () => {
  it('returns null when the browser has no speech recognition', () => {
    expect(getRecognitionCtor({})).toBeNull()
    expect(getRecognitionCtor(undefined)).toBeNull()
  })

  it('falls back to the webkit prefix', () => {
    const { Ctor } = buildFakeRecognition()
    expect(getRecognitionCtor({ webkitSpeechRecognition: Ctor })).toBe(Ctor)
  })
})
