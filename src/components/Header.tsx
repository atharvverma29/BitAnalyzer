import React from 'react';
import { RefreshCw, Activity, AlertCircle } from 'lucide-react';

export type NavTab = 'overview' | 'signal' | 'backtest' | 'risk' | 'macro' | 'methodology';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isLoading: boolean;
  onRefresh: () => void;
  lastUpdated: number | null;
  provider: string;
  isFallback: boolean;
  autoRefreshInterval: number; // 0 for off, seconds
  setAutoRefreshInterval: (interval: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isLoading,
  onRefresh,
  lastUpdated,
  provider,
  isFallback,
  autoRefreshInterval,
  setAutoRefreshInterval,
}) => {
  const formatTime = (ts: number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-slate-100 shrink-0 sticky top-0 z-30">
      {/* Zone 1: Single Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="text-base font-semibold tracking-tight text-white flex items-center gap-2.5 whitespace-nowrap"
        >
          <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-mono font-bold">
            ₿
          </div>
          <span>Bitcoin Spot Analyzer</span>
        </a>
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <span>·</span>
          <span>Quant Terminal</span>
        </div>
      </div>

      {/* Zone 2: Navigation Links (single-line, clean unboxed typography) */}
      <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'overview'
              ? 'bg-slate-800 text-amber-400 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Overview & Charts
        </button>
        <button
          onClick={() => setActiveTab('signal')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'signal'
              ? 'bg-slate-800 text-amber-400 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Quant Engine
        </button>
        <button
          onClick={() => setActiveTab('backtest')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'backtest'
              ? 'bg-slate-800 text-amber-400 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Backtesting Lab
        </button>
        <button
          onClick={() => setActiveTab('risk')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'risk'
              ? 'bg-slate-800 text-amber-400 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Risk Calculator
        </button>
        <button
          onClick={() => setActiveTab('macro')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'macro'
              ? 'bg-slate-800 text-amber-400 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Macro Journal
        </button>
        <button
          onClick={() => setActiveTab('methodology')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'methodology'
              ? 'bg-slate-800 text-amber-400 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          Methodology
        </button>
      </nav>

      {/* Zone 3: Primary Action & Live Telemetry Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            {isFallback ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {provider}
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                {provider || 'Connecting...'}
              </span>
            )}
          </span>
          <span>·</span>
          <span className="tabular-nums">{formatTime(lastUpdated)}</span>
        </div>

        {/* Auto-refresh interval dropdown */}
        <select
          value={autoRefreshInterval}
          onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
          title="Auto-refresh cadence"
        >
          <option value={0}>Manual</option>
          <option value={15}>15s Auto</option>
          <option value={30}>30s Auto</option>
          <option value={60}>60s Auto</option>
        </select>

        {/* Manual Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          title="Refresh market data now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
};
