import { createRoot } from 'react-dom/client'
import './styles.css'

const App = () => {
  return (
    <main className="review-shell">
      <h1>MapRoulette Review</h1>
      <p>Standalone plugin host is running.</p>
      <p>
        Plugin bundle URL:
        <code>/maprouletteReviewPlugin.js</code>
      </p>
    </main>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
