// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToasts } from './use-toasts'

describe('useToasts', () => {
  it('adds and auto-removes toasts', async () => {
    const { result } = renderHook(() => useToasts())

    act(() => { result.current.addToast('Test message', 'success') })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Test message')
    expect(result.current.toasts[0].type).toBe('success')
  })

  it('removeToast removes by id', () => {
    const { result } = renderHook(() => useToasts())

    act(() => { result.current.addToast('msg1', 'success') })
    const id = result.current.toasts[0].id
    act(() => { result.current.removeToast(id) })
    expect(result.current.toasts).toHaveLength(0)
  })
})
