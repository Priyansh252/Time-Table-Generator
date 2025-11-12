import './styles.css'
import TimetableGenerator from './TimetableGenerator'

function App() {
  return (
    <div className="timetable-shell">
      <div className="container">
        {/* New Top-Level Header */}
        <div className="app-header-wrap">
            <div className="app-header-title">Timetable Generator</div>
            <div className="app-header-sub">
                Create conflict-free maximal timetables · Limit 10 courses
            </div>
        </div>

        {/* TimetableGenerator now manages its own grid layout */}
        <TimetableGenerator />

        {/* The footer is now empty as requested */}
        <div className="footer">
        </div>
      </div>
    </div>
  )
}

export default App