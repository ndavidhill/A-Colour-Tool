'use client';
import { useState } from 'react';

export default function Dropdown({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      marginBottom: 10,
      borderRadius: 5,
      background: 'var(--color-accent)',
      padding: 5,
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          cursor: 'pointer',
          fontWeight: 'bold',
          padding: 5,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 12,
          letterSpacing: '0.02rem',
          textTransform: 'uppercase',
          userSelect: 'none',
          color: 'var(--color-fg)',
        }}
      >
        {open ? '▾' : '▸'} {title}
      </div>
      {open && (
        <div style={{ padding: 5 }}>
          {children}
        </div>
      )}
    </div>
  );
}
