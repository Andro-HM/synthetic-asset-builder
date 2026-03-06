// src/App.jsx
import React, { useState } from 'react';
import Navbar from './components/Navbar';
import SingleAssetViewer from './components/SingleAssetViewer';
import SyntheticBuilder from './components/SyntheticBuilder';
import RatioViewer from './components/RatioViewer';

export default function App() {
  const [activeView, setActiveView] = useState('single');

  return (
    <div className="min-h-screen" style={{ background: '#131722' }}>
      <Navbar activeView={activeView} onViewChange={setActiveView} />
      {activeView === 'single'    && <SingleAssetViewer />}
      {activeView === 'synthetic' && <SyntheticBuilder />}
      {activeView === 'ratio'     && <RatioViewer />}
    </div>
  );
}
