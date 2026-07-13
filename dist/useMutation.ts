'use client'

import { useCallback, useRef, useState } from 'react'

interface MutationState<T = unknown> {
  data?: T
  error?: Error | null
  loading: boolean
  idle: boolean
}

type MutationFn<T, V = unknown> = (vars: V) => Promise<T>

interface UseMutationReturn<T, V = unknown> extends MutationState<T> {
  mutate: (vars: V) => Promise<T | undefined>
  mutateAsync: (vars: V) => Promise<T | undefined>
  reset: () => void
}

/**
 * Tiny async mutation hook with loading/error state and stale-result guard.
 */
export function useMutation<T = unknown, V = unknown>(
  fn: MutationFn<T, V>,
  {
    onSuccess,
    onError,
  }: { onSuccess?: (data: T, vars: V) => void; onError?: (err: Error, vars: V) => void } = {}
): UseMutationReturn<T, V> {
  const [state, setState] = useState<MutationState<T>>({ loading: false, idle: true, error: null })
  const versionRef = useRef(0)

  const mutateAsync = useCallback(
    async (vars: V) => {
      const v = ++versionRef.current
      setState({ loading: true, idle: false, error: null })
      try {
        const data = await fn(vars)
        if (versionRef.current !== v) return undefined
        setState({ data, loading: false, idle: false, error: null })
        onSuccess?.(data, vars)
        return data
      } catch (err) {
        if (versionRef.current !== v) return undefined
        const error = err instanceof Error ? err : new Error(String(err))
        setState({ loading: false, idle: false, error })
        onError?.(error, vars)
        throw error
      }
    },
    [fn, onSuccess, onError]
  )

  const mutate = useCallback(
    (vars: V) => {
      return mutateAsync(vars).catch(() => undefined)
    },
    [mutateAsync]
  )

  const reset = useCallback(() => {
    versionRef.current++
    setState({ loading: false, idle: true, error: null })
  }, [])

  return {
    ...state,
    mutate,
    mutateAsync,
    reset,
  }
}
