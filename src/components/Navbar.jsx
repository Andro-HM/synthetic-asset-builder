// src/components/Navbar.jsx
import React from 'react';
import { TrendingUp, GitMerge } from 'lucide-react';

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
        <button
          onClick={() => onViewChange('single')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: activeView === 'single' ? '#26a69a22' : 'transparent',
            color: activeView === 'single' ? '#26a69a' : '#787b86',
            borderRight: '1px solid #2a2e39'
          }}
        >
          <TrendingUp size={14} /> Single Asset
        </button>
        <button
          onClick={() => onViewChange('synthetic')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: activeView === 'synthetic' ? '#26a69a22' : 'transparent',
            color: activeView === 'synthetic' ? '#26a69a' : '#787b86'
          }}
        >
          <GitMerge size={14} /> Synthetic Builder
        </button>
      </div>
    </nav>
  );
}
