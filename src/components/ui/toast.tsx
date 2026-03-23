'use client'

import type { Toast } from '@/lib/hooks/use-toasts'
import styles from './toast.module.scss'

interface ToastContainerProps {
  toasts: Toast[]
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
