/** Thrown by the chat transport's fetch when /api/chat answers with a non-2xx status. */
export class ChatHttpError extends Error {
  constructor(public readonly status: number, message?: string) {
    super(message ?? `Chat request failed with status ${status}`)
    this.name = 'ChatHttpError'
  }
}

export const SIGN_IN_MESSAGE = 'You are signed out. Please sign in and try again.'
export const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/** Map a chat failure to the text shown inline. 401 asks for sign-in; everything else is a generic retry. */
export function getChatErrorMessage(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status
  if (status === 401) return SIGN_IN_MESSAGE
  return GENERIC_MESSAGE
}
