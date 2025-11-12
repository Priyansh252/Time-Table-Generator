import React, { useState, useEffect } from 'react';
import ConflictGraphVisualizer from './ConflictGraphVisualizer';

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function minutesFromTime(s) {
  const [hh, mm] = String(s).split(':').map(x => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function prettyTime(m) {
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function TimetableGenerator() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [sessions, setSessions] = useState([]);
  const [dayInput, setDayInput] = useState('Mon');
  const [startInput, setStartInput] = useState('09:00');
  const [endInput, setEndInput] = useState('10:00');
  const [results, setResults] = useState([]);
  const [conflictGraph, setConflictGraph] = useState([]);
  const [selectedTimetableIndex, setSelectedTimetableIndex] = useState(0); // <--- NEW STATE
  const [search, setSearch] = useState('');
  const [recentIndex, setRecentIndex] = useState(null);
  const [error, setError] = useState('');

  const palette = [
    ['#6C63FF', '#E9E7FF'],
    ['#FF6FA3', '#FFF0F6'],
    ['#00C2A8', '#E6FFFA'],
    ['#FFB86B', '#FFF7EB'],
    ['#8BD3FF', '#F0FBFF'],
  ];

  useEffect(() => {
    if (recentIndex !== null) {
      const t = setTimeout(() => setRecentIndex(null), 900);
      return () => clearTimeout(t);
    }
  }, [recentIndex]);

  function addSession() {
    setError('');
    const s = minutesFromTime(startInput);
    const e = minutesFromTime(endInput);
    if (s === null || e === null) {
      setError('Invalid time');
      return;
    }
    if (e <= s) {
      setError('End time must be after start');
      return;
    }
    setSessions(prev => [...prev, { day: dayInput, start: s, end: e }]);
  }

  function removeSession(i) {
    setSessions(prev => prev.filter((_, idx) => idx !== i));
  }

  function resetForm() {
    setCourseId('');
    setCourseName('');
    setFaculty('');
    setSessions([]);
    setDayInput('Mon');
    setStartInput('09:00');
    setEndInput('10:00');
    setError('');
  }

  function addCourse() {
    setError('');
    if (!courseId.trim() || !courseName.trim()) {
      setError('Course ID and name required');
      return;
    }
    if (courses.length >= 10) {
      setError('Maximum 10 courses');
      return;
    }
    if (sessions.length === 0) {
      setError('Add at least one session');
      return;
    }
    if (courses.some(c => c.id === courseId.trim())) {
      setError('Duplicate Course ID');
      return;
    }

    const idx = courses.length;
    const newCourse = {
      id: courseId.trim(),
      name: courseName.trim(),
      faculty: faculty.trim(),
      sessions,
    };
    setCourses(prev => [...prev, newCourse]);
    resetForm();
    setRecentIndex(idx);
    setResults([]); 
    setConflictGraph([]); 
    setSelectedTimetableIndex(0); // <--- Reset selection
  }

  function sessionsOverlap(a, b) {
    if (a.day !== b.day) return false;
    return a.start < b.end && b.start < a.end;
  }

  function coursesConflict(a, b) {
    for (const sa of a.sessions)
      for (const sb of b.sessions)
        if (sessionsOverlap(sa, sb)) return true;
    return false;
  }

  function buildConflict(coursesList) {
    const n = coursesList.length;
    const conflict = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (coursesConflict(coursesList[i], coursesList[j])) {
          conflict[i].add(j);
          conflict[j].add(i);
        }
      }
    }
    return conflict;
  }

  function maximalIndependentSets(conflict) {
    const n = conflict.length;
    const comp = Array.from({ length: n }, (_, i) => {
      const s = new Set();
      for (let j = 0; j < n; j++) {
        if (i !== j && !conflict[i].has(j)) s.add(j);
      }
      return s;
    });
    const results = [];

    function intersect(a, b) {
      const r = new Set();
      for (const x of a) if (b.has(x)) r.add(x);
      return r;
    }

    function bron(R, P, X) {
      if (P.size === 0 && X.size === 0) {
        results.push(new Set(R));
        return;
      }
      const PX = new Set([...P, ...X]);
      let u = null,
        best = -1;
      for (const cand of PX) {
        const inter = Array.from(P).filter(v => comp[cand].has(v)).length;
        if (inter > best) {
          best = inter;
          u = cand;
        }
      }
      const candidates = new Set(
        Array.from(P).filter(v => !(u !== null && comp[u].has(v)))
      );
      for (const v of Array.from(candidates)) {
        bron(
          new Set([...R, v]),
          intersect(P, comp[v]),
          intersect(X, comp[v])
        );
        P.delete(v);
        X.add(v);
      }
    }

    bron(new Set(), new Set(Array.from({ length: n }, (_, i) => i)), new Set());
    return results;
  }

  function compute() {
    setError('');
    if (courses.length === 0) {
      setError('Add at least one course');
      setResults([]);
      setConflictGraph([]); 
      setSelectedTimetableIndex(0); // <--- Reset selection
      return;
    }
    const conflict = buildConflict(courses);
    setConflictGraph(conflict); 
    const maximal = maximalIndependentSets(conflict);
    maximal.sort(
      (a, b) =>
        b.size - a.size ||
        (Array.from(a).join(',') > Array.from(b).join(',') ? 1 : -1)
    );
    setResults(maximal);
    setSelectedTimetableIndex(0); // <--- Default to Timetable 1
  }

  function escapeCsv(s) {
    const str = String(s || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n'))
      return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  function downloadCSV(setIndices, indexNum) {
    const included = Array.from(setIndices).sort((a, b) => a - b);
    let csv = 'Course ID,Course Name,Faculty,Day,Start,End\n';
    for (const i of included) {
      const c = courses[i];
      for (const s of c.sessions)
        csv += `${escapeCsv(c.id)},${escapeCsv(
          c.name
        )},${escapeCsv(c.faculty)},${s.day},${prettyTime(
          s.start
        )},${prettyTime(s.end)}\n`;
    }
    csv += '\nExcluded (Course ID - Course Name),Conflicts With\n';
    for (let i = 0; i < courses.length; i++) {
      if (included.includes(i)) continue;
      const currentConflict = conflictGraph.length > 0 ? conflictGraph : buildConflict(courses); 
      
      const conflicts = Array.from(currentConflict[i])
        .filter(j => included.includes(j))
        .map(j => `${courses[j].id} - ${courses[j].name}`);

      csv += `${escapeCsv(
        courses[i].id + ' - ' + courses[i].name
      )},${escapeCsv(conflicts.join('; '))}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_${indexNum}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function colorForIndex(i) {
    const p = palette[i % palette.length];
    return { background: p[1], color: p[0], chip: p[0] };
  }

  function filteredCourses() {
    if (!search.trim()) return courses;
    const q = search.trim().toLowerCase();
    return courses.filter(
      c =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.faculty || '').toLowerCase().includes(q)
    );
  }

  // --- RENDERING ---
  return (
    <div className="grid">
        {/* Left Panel: Add Course & Course List */}
        <aside className="card">
          <h3 className="header-title" style={{ marginTop: 0, marginBottom: 16 }}>
             <span style={{color: '#6366f1'}}>➕</span> Add Course Details
          </h3>

          <label className="label">Course ID</label>
          <input
            value={courseId}
            onChange={e => setCourseId(e.target.value)}
            className="input"
          />

          <label className="label">
            Course Name
          </label>
          <input
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
            className="input"
          />

          <label className="label">
            Faculty (optional)
          </label>
          <input
            value={faculty}
            onChange={e => setFaculty(e.target.value)}
            className="input"
          />

          <label className="label">
            Sessions
          </label>
          <div className="session-row">
            <select
              value={dayInput}
              onChange={e => setDayInput(e.target.value)}
              className="select"
            >
              {DAY_OPTIONS.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              value={startInput}
              onChange={e => setStartInput(e.target.value)}
              className="time"
              type="time"
            />
            <input
              value={endInput}
              onChange={e => setEndInput(e.target.value)}
              className="time"
              type="time"
            />
            <button onClick={addSession} className="btn btn-primary">
              Add
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {sessions.length === 0 ? (
              <div className="small-note">No sessions added for this course yet.</div>
            ) : (
              <div className="session-list">
                {sessions.map((s, i) => (
                  <span key={i} className="session-item">
                    {s.day} · {prettyTime(s.start)}-{prettyTime(s.end)}
                    <button
                      onClick={() => removeSession(i)}
                      className="btn btn-ghost"
                      aria-label="Remove session"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ color: '#c53030', marginTop: 16, fontWeight: 600 }}>Error: {error}</div>
          )}

          <div style={{ marginTop: 20 }} className="row">
            <button
              onClick={addCourse}
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={courses.length >= 10}
            >
              Add Course ({courses.length}/10)
            </button>
            <button
              onClick={resetForm}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              Clear Form
            </button>
          </div>
          
          <div style={{ marginTop: 24, paddingBottom: 10, borderBottom: '1px solid #e5e7eb', marginBottom: 14 }}>
            <div style={{ fontWeight: 800 }}>Courses Added</div>
            <div className="small-note" style={{padding: '4px 0'}}>
                Filter courses by ID, name, or faculty.
            </div>
          </div>

          <div className="courses-list">
            <input
                placeholder="Filter courses..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search"
                style={{ marginBottom: 16 }}
            />
            {filteredCourses().map((c, idx) => {
              const origIndex = courses.indexOf(c);
              const col = colorForIndex(origIndex);
              return (
                <div
                  key={origIndex}
                  className={`course-card ${
                    recentIndex === origIndex ? 'recent' : ''
                  }`}
                  style={{ borderLeftColor: col.chip }}
                >
                  <div className="course-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        className="color-chip"
                        style={{ background: col.chip }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="course-name">
                          {c.name}{' '}
                          <span
                            style={{
                              fontSize: 13,
                              color: '#6b7280',
                              fontWeight: 400
                            }}
                          >
                            ({c.id})
                          </span>
                        </div>
                        <div className="course-meta">
                          {c.faculty || 'Unassigned'}
                        </div>
                      </div>
                    </div>

                    <div className="session-list" style={{ marginTop: 10 }}>
                      {c.sessions.map((s, si) => (
                        <div key={si} className="session-item">
                          {s.day} · {prettyTime(s.start)} - {prettyTime(s.end)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      alignItems: 'flex-end',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      Index: {origIndex}
                    </div>
                    <button
                      onClick={() => {
                        const arr = courses.filter((_, i) => i !== origIndex);
                        setCourses(arr);
                        setResults([]); 
                        setConflictGraph([]); 
                        setSelectedTimetableIndex(0); // <--- Reset selection
                      }}
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px', fontSize: 13 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredCourses().length === 0 && courses.length > 0 && (
              <div className="small-note" style={{padding: '8px 0'}}>No courses match your filter.</div>
            )}
            {courses.length === 0 && (
                <div className="small-note" style={{padding: '8px 0'}}>Your course list is empty. Add courses above to begin.</div>
            )}
          </div>
        </aside>

        {/* Right Panel: Results & Compute */}
        <main className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 className="header-title" style={{ margin: 0, fontSize: 22 }}>
                 <span style={{color: '#8b5cf6'}}>📋</span> Timetable Results
              </h2>
              <div className="header-sub">
                Conflict-free timetables maximizing the number of courses.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  if(window.confirm('Are you sure you want to clear ALL courses and results?')) {
                    setCourses([]);
                    setResults([]);
                    setConflictGraph([]); 
                    setSelectedTimetableIndex(0); // <--- Reset selection
                    setSearch('');
                  }
                }}
                className="btn btn-ghost"
              >
                Clear All
              </button>
              <button onClick={compute} className="btn btn-primary" disabled={courses.length === 0}>
                Compute Timetables ({courses.length} courses)
              </button>
            </div>
          </div>

          {/* Graph Visualization Section - New Division */}
          <div style={{display: 'flex', gap: 20, marginTop: 24}}>
             <div style={{flex: 1}}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <h4 style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e', margin: 0 }}>
                        Conflict Graph
                    </h4>
                    {results.length > 0 && (
                        <select
                            value={selectedTimetableIndex}
                            onChange={e => setSelectedTimetableIndex(parseInt(e.target.value, 10))}
                            className="select"
                            style={{ width: 'fit-content', padding: '6px 10px', fontSize: 14, borderRadius: 8, height: 'auto' }}
                        >
                            {results.map((_, i) => (
                                <option key={i} value={i}>
                                    View Timetable {i + 1}
                                </option>
                            ))}
                        </select>
                    )}
                    <span style={{fontSize: 14, fontWeight: 400, color: '#6b7280'}}>(Edges = Time Conflict)</span>
                </div>
                <ConflictGraphVisualizer 
                    courses={courses} 
                    conflict={conflictGraph}
                    results={results}
                    palette={palette} 
                    selectedTimetableIndex={selectedTimetableIndex} // <--- PASS NEW PROP
                />
             </div>
             
             {/* Timetable Results List Section */}
             <div style={{flex: 1}}>
                <div style={{ paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 800 }}>Possible Timetables ({results.length})</div>
                </div>

                <div className="results-wrap">
                  {results.length === 0 && (
                    <div style={{ color: '#6b7280' }}>
                      Click **Compute Timetables** to find all conflict-free maximal combinations.
                    </div>
                  )}

                  {results.map((setIdx, i) => {
                    const included = Array.from(setIdx).sort((a, b) => a - b);
                    const leftColor = palette[i % palette.length][0];
                    return (
                      <div
                        key={i}
                        className="result-card"
                        style={{ borderLeftColor: leftColor, border: selectedTimetableIndex === i ? '2px solid #6366f1' : '1px solid #e0e7ff'}} // <--- HIGHLIGHT SELECTED RESULT
                      >
                        <div className="result-left">
                          <div className="result-title">
                              Timetable {i + 1} · {included.length} Course{included.length !== 1 ? 's' : ''}
                          </div>
                          <div className="result-course-list">
                            <div style={{ fontSize: 13, color: '#6b7280' }}>
                              {included.map(ci => (
                                <span
                                  key={ci}
                                  style={{
                                    display: 'inline-block',
                                    marginRight: 8,
                                    marginBottom: 6,
                                    padding: '6px 10px',
                                    borderRadius: 10,
                                    background:
                                      palette[ci % palette.length][1],
                                    color: palette[ci % palette.length][0],
                                    fontWeight: 600,
                                    fontSize: 12,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {courses[ci]?.id ?? '?'} -{' '}
                                  {courses[ci]?.name ?? '?'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div
                          className="result-actions"
                          style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}
                        >
                            <button
                                onClick={() => setSelectedTimetableIndex(i)} // <--- SELECT BUTTON
                                className="btn btn-ghost"
                                style={{ padding: '8px 14px', fontSize: 14, border: '1px solid #6366f1', color: '#6366f1', background: selectedTimetableIndex === i ? '#e0e7ff' : '#ffffff' }}
                                disabled={selectedTimetableIndex === i}
                            >
                                {selectedTimetableIndex === i ? 'Viewing' : 'View Graph'}
                            </button>
                            <button
                                onClick={() => downloadCSV(setIdx, i + 1)}
                                className="btn btn-primary"
                                style={{ padding: '8px 14px', fontSize: 14 }}
                            >
                                Download CSV
                            </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>

          <div style={{ marginTop: 20 }} className="small-note">
            The results are ranked by size (number of courses). All displayed timetables are **maximal**, meaning no more courses can be added to them without causing a time conflict.
          </div>
        </main>
      </div>
  );
}