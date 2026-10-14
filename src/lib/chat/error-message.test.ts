import { describe, it, expect } from 'vitest'
import { ChatHttpError, getChatErrorMessage, SIGN_IN_MESSAGE, GENERIC_MESSAGE } from './error-message'

describe('getChatErrorMessage', () => {
  it('asks for sign-in on 401', () => {
    expect(getChatErrorMessage(new ChatHttpError(401))).toBe(SIGN_IN_MESSAGE)
  })

  it('shows a generic try-again message on 500', () => {
    expect(getChatErrorMessage(new ChatHttpError(500))).toBe(GENERIC_MESSAGE)
  })

  it('shows a generic try-again message on a network failure', () => {
    expect(getChatErrorMessage(new TypeError('Failed to fetch'))).toBe(GENERIC_MESSAGE)
  })
})
