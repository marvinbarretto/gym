'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface RecognitionAlternative {
  transcript: string
}

interface RecognitionResult {
  0: RecognitionAlternative
  length: number
}

export interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>
}

export interface RecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

export type RecognitionCtor = new () => RecognitionLike

export interface SpeechState {
  listening: boolean
  transcript: string
}

interface ControllerOptions {
  onChange: (state: SpeechState) => void
  onEnd?: (transcript: string) => void
  lang?: string
}

/** Resolves the browser's constructor, with the webkit prefix Safari needs. */
export function getRecognitionCtor(
  win: object | undefined,
): RecognitionCtor | null {
  if (!win) return null
  const w = win as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as RecognitionCtor | null
}

/** Framework-free core of the hook, so it can be tested with a fake recognition class. */
export function createSpeechController(Ctor: RecognitionCtor, opts: ControllerOptions) {
  let recognition: RecognitionLike | null = null
  let transcript = ''

  function emit(listening: boolean) {
    opts.onChange({ listening, transcript })
  }

  function start() {
    if (recognition) return
    transcript = ''
    const r = new Ctor()
    r.continuous = false
    r.interimResults = true
    r.lang = opts.lang ?? 'en-GB'
    r.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      transcript = text
      emit(true)
    }
    const finish = () => {
      if (recognition !== r) return
      recognition = null
      emit(false)
      opts.onEnd?.(transcript)
    }
    r.onerror = finish
    r.onend = finish
    recognition = r
    emit(true)
    r.start()
  }

  function stop() {
    recognition?.stop()
  }

  return { start, stop }
}

export function useSpeechRecognition(options: { onEnd?: (transcript: string) => void } = {}) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<SpeechState>({ listening: false, transcript: '' })
  const controllerRef = useRef<ReturnType<typeof createSpeechController> | null>(null)
  const onEndRef = useRef(options.onEnd)

  useEffect(() => {
    onEndRef.current = options.onEnd
  })

  // Detect support after mount so server and client markup match
  useEffect(() => {
    const Ctor = getRecognitionCtor(window)
    if (!Ctor) return
    controllerRef.current = createSpeechController(Ctor, {
      onChange: setState,
      onEnd: (t) => onEndRef.current?.(t),
    })
    setSupported(true)
  }, [])

  const start = useCallback(() => controllerRef.current?.start(), [])
  const stop = useCallback(() => controllerRef.current?.stop(), [])

  return { supported, listening: state.listening, transcript: state.transcript, start, stop }
}
