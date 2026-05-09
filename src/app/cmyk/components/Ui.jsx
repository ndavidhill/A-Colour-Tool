'use client';
import { useState } from 'react';

export const inputStyle = {
  width: '100%',
  padding: '3px 6px',
  background: 'var(--color-bg)',
  color: 'var(--color-fg)',
  borderRadius: 5,
  border: 'none',
  marginTop: 4,
  height: 24,
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: 12,
  letterSpacing: '0.02rem',
  textTransform: 'uppercase',
  fontWeight: 'bold',
  outline: 'none',
  boxSizing: 'border-box',
};

export const labelStyle = {
  display: 'block',
  margin: '8px 0 4px',
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: 12,
  fontWeight: 'bold',
  letterSpacing: '0.02rem',
  textTransform: 'uppercase',
};

export function Btn({ onClick, children, red, style }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: red ? 'red' : 'var(--color-fg)',
        color: 'var(--color-bg)',
        borderRadius: 5,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.02rem',
        padding: '5px 10px',
        cursor: 'pointer',
        border: 0,
        margin: '5px 4px 5px 0',
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontWeight: 'bold',
        opacity: hov ? 0.25 : 1,
        transition: 'opacity 0.1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function RangeRow({ label, min, max, value, onChange }) {
  return (
    <>
      <label style={labelStyle}>
        {label} <span style={{ marginLeft: 5 }}>{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', height: 20, cursor: 'pointer' }}
      />
    </>
  );
}
