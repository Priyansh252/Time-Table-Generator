import React from 'react';

// Configuration for drawing
const CANVAS_SIZE = 400;
const NODE_RADIUS = 15;

// Helper to determine position of nodes in a circle
function getNodePosition(index, total) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Start from top
  const radius = CANVAS_SIZE / 2 - NODE_RADIUS - 30; // 30 is padding
  const centerX = CANVAS_SIZE / 2;
  const centerY = CANVAS_SIZE / 2;

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

// Function from TimetableGenerator.jsx to determine course color
function colorForIndex(i, palette) {
  const p = palette[i % palette.length];
  return { background: p[1], color: p[0], chip: p[0] };
}

export default function ConflictGraphVisualizer({ courses, conflict, results, palette, selectedTimetableIndex }) { // <--- ADD NEW PROP
  if (courses.length === 0) {
    return (
      <div style={{ height: CANVAS_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', border: '1px dashed #e5e7eb', borderRadius: 12 }}>
        Add courses to visualize the conflict graph.
      </div>
    );
  }

  const n = courses.length;
  const positions = Array.from({ length: n }, (_, i) => getNodePosition(i, n));

  // Determine the highlight set based on the selectedTimetableIndex
  let includedIndices = new Set();
  if (results.length > selectedTimetableIndex) { // Check if the index is valid
    includedIndices = results[selectedTimetableIndex];
  }
  
  const MIS_HIGHLIGHT_COLOR = '#4f46e5'; // Deep blue for included nodes
  const EXCLUDED_COLOR = '#9ca3af'; // Gray for excluded nodes

  return (
    <div style={{ padding: 10, position: 'relative' }}>
      <div style={{ height: CANVAS_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e7ff', borderRadius: 16 }}>
        {results.length === 0 ? (
          <div style={{ color: '#6b7280' }}>Compute timetables to see the graph.</div>
        ) : (
          <svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ display: 'block', margin: '0 auto', background: '#f9faff', borderRadius: 16, boxShadow: 'inset 0 0 10px rgba(0,0,0,0.02)' }}>
            {/* Draw Edges (Conflicts) */}
            {conflict.map((conflicts, i) =>
              Array.from(conflicts)
                .filter(j => i < j) // Draw each edge once
                .map(j => {
                  const p1 = positions[i];
                  const p2 = positions[j];
                  
                  const isIncludedI = includedIndices.has(i);
                  const isIncludedJ = includedIndices.has(j);

                  let strokeColor = EXCLUDED_COLOR;
                  let strokeWidth = 1.5;

                  if (isIncludedI && isIncludedJ) {
                    // This should theoretically not happen if results are true MIS
                    strokeColor = '#ff6347'; 
                    strokeWidth = 2;
                  } else if (!isIncludedI && !isIncludedJ) {
                    // Conflict between two excluded courses (minor conflict)
                    strokeColor = '#e5e7eb';
                    strokeWidth = 1;
                  } else {
                    // Critical conflict: Included course conflicts with an excluded course
                    strokeColor = '#dc2626'; // Red
                    strokeWidth = 2.5; // Bold line
                  }
                  
                  return (
                    <line
                      key={`${i}-${j}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                    />
                  );
                })
            )}

            {/* Draw Nodes (Courses) */}
            {courses.map((course, i) => {
              const pos = positions[i];
              const col = colorForIndex(i, palette);
              const isIncluded = includedIndices.has(i);

              const nodeStroke = isIncluded ? MIS_HIGHLIGHT_COLOR : EXCLUDED_COLOR;
              const nodeFill = isIncluded ? col.background : '#f3f4f6';
              const textFill = isIncluded ? MIS_HIGHLIGHT_COLOR : EXCLUDED_COLOR;

              return (
                <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
                  {/* Node Circle */}
                  <circle
                    cx="0"
                    cy="0"
                    r={NODE_RADIUS}
                    fill={nodeFill}
                    stroke={nodeStroke}
                    strokeWidth={isIncluded ? 4 : 2}
                    style={{ transition: 'all 0.3s ease-in-out' }}
                  />
                  {/* Node Index Text */}
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={textFill}
                  >
                    {i}
                  </text>
                  {/* Tooltip-like label below the node */}
                  <text
                    x="0"
                    y={NODE_RADIUS + 15}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#374151"
                    fontWeight="500"
                  >
                    {course.id}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <div style={{textAlign: 'center', marginTop: 15, fontSize: 13, color: '#9ca3af'}}>
        Nodes are course indices. **Bold/Red edges** show conflicts that caused a course to be excluded from the **current viewing timetable**. **Blue outline** indicates inclusion.
      </div>
    </div>
  );
}