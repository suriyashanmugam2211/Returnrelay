import React from 'react';
import { RotateCcw, Sparkles, BookOpen } from 'lucide-react';
import { HealthInfo } from '../types.ts';

interface HeaderProps {
  activeTab: 'assistant' | 'orders' | 'cases' | 'activity';
  setActiveTab: (tab: 'assistant' | 'orders' | 'cases' | 'activity') => void;
  health: HealthInfo | null;
  onReset: () => void;
  onOpenGuide: () => void;
  resetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  health,
  onReset,
  onOpenGuide,
  resetting,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      {/* Simulation Notice Strip */}
      <div className="bg-slate-950 px-4 py-1.5 text-xs text-slate-400 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>Simulated Alexa+ Agent Environment</span>
          <span aria-hidden="true">·</span>
          <span>Demonstration Customer Account</span>
          <span aria-hidden="true">·</span>
          <span>All orders and returns are simulated demonstration data</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-slate-400 font-mono text-[11px] tabular-nums">
          <span>Simulation Date: {health?.demoClockReferenceDate || '2026-10-22'}</span>
        </div>
      </div>

      {/* Main Top Bar (Strict 3-zone contract) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center overflow-hidden">
            <img
              src="/src/assets/images/returnrelay_logo_1792650318265.jpg"
              alt="ReturnRelay Logo"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // styled SVG fallback
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <button
              onClick={() => setActiveTab('assistant')}
              className="text-lg font-bold tracking-tight text-white hover:text-cyan-300 transition-colors whitespace-nowrap text-left"
            >
              ReturnRelay
            </button>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Single-line unboxed text) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`whitespace-nowrap transition-colors pb-0.5 border-b-2 ${
              activeTab === 'assistant'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Alexa+ Assistant
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`whitespace-nowrap transition-colors pb-0.5 border-b-2 ${
              activeTab === 'orders'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Simulated Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cases')}
            className={`whitespace-nowrap transition-colors pb-0.5 border-b-2 ${
              activeTab === 'cases'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Resolution Cases
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`whitespace-nowrap transition-colors pb-0.5 border-b-2 ${
              activeTab === 'activity'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            Activity Audit
          </button>
        </nav>

        {/* Zone 3: Primary Action & Quick Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            title="Explore Sample Scenarios & Guide"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Scenario Guide</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
            title="Reset demonstration data to deterministic initial state"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{resetting ? 'Resetting...' : 'Reset Demo'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800 px-2 py-2 bg-slate-900/90 text-xs">
        <button
          onClick={() => setActiveTab('assistant')}
          className={`px-2.5 py-1 rounded ${activeTab === 'assistant' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400'}`}
        >
          Assistant
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-2.5 py-1 rounded ${activeTab === 'orders' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400'}`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab('cases')}
          className={`px-2.5 py-1 rounded ${activeTab === 'cases' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400'}`}
        >
          Cases
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-2.5 py-1 rounded ${activeTab === 'activity' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400'}`}
        >
          Activity
        </button>
      </div>
    </header>
  );
};
