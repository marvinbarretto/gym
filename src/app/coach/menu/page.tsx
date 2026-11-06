import { MenuAdviceForm } from './menu-advice-form'
import styles from './page.module.scss'

export default function CoachMenuPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Menu help</h1>
      <p className={styles.hint}>Paste the menu, one item per line.</p>
      <MenuAdviceForm />
    </main>
  )
}
