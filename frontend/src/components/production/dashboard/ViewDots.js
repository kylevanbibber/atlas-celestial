/**
 * ViewDots — small pagination indicator for togglable widgets.
 * Renders a row of dots with the active one highlighted.
 */
import React from 'react';

const ViewDots = ({ count, activeIndex }) => {
  if (!count || count <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0 2px' }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i === activeIndex ? 'var(--foreground)' : 'var(--muted-foreground, #888)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
};

export default ViewDots;
