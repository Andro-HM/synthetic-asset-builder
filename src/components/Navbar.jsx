// src/components/Navbar.jsx
import React from 'react';
import { TrendingUp, GitMerge, Divide } from 'lucide-react';

const VIEWS = [
  { id: 'single',    label: 'Single Asset',    Icon: TrendingUp },
  { id: 'synthetic', label: 'Synthetic Builder', Icon: GitMerge  },
  { id: 'ratio',     label: 'Ratio Viewer',    Icon: Divide     },
];

export default function Navbar({ activeView, onViewChange }) {
  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b"
      style={{ background: '#1e222d', borderColor: '#2a2e39' }}>
      <div className="flex items-center gap-2">
        <TrendingUp size={22} style={{ color: '#26a69a' }} />
        <span className="font-bold text-lg tracking-wide" style={{ color: '#d1d4dc' }}>
          Synthetic Asset Builder
        </span>
      </div>

      <div className="flex rounded overflow-hidden border" style={{ borderColor: '#2a2e39' }}>
        {VIEWS.map(({ id, label, Icon }, idx) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: activeView === id ? '#26a69a22' : 'transparent',
              color: activeView === id ? '#26a69a' : '#787b86',
              borderRight: idx < VIEWS.length - 1 ? '1px solid #2a2e39' : 'none',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
