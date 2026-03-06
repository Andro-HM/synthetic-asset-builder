// src/components/LiveSearch.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader } from 'lucide-react';
import { searchInstruments } from '../utils/api';

export default function LiveSearch({ onSelect, placeholder = 'Search ticker or name...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceTimer = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchInstruments(query);
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(item) {
    setQuery('');
    setOpen(false);
    setResults([]);
    onSelect(item);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2 px-3 py-2 rounded border"
        style={{ background: '#131722', borderColor: '#2a2e39' }}>
        {loading
          ? <Loader size={16} className="animate-spin" style={{ color: '#787b86' }} />
          : <Search size={16} style={{ color: '#787b86' }} />}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: '#d1d4dc' }}
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 rounded border overflow-hidden shadow-2xl"
          style={{ background: '#1e222d', borderColor: '#2a2e39', maxHeight: '280px', overflowY: 'auto' }}>
          {results.map(item => (
            <li
              key={item.ticker}
              onClick={() => handleSelect(item)}
              className="flex justify-between items-center px-4 py-2 cursor-pointer text-sm hover:bg-opacity-50 transition"
              style={{ borderBottom: '1px solid #2a2e39' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2e39'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span className="font-semibold" style={{ color: '#26a69a' }}>{item.ticker}</span>
              <span className="truncate ml-4 text-right" style={{ color: '#787b86', maxWidth: '60%' }}>{item.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
