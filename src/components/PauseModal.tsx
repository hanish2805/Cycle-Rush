import React from 'react';
import { Home, Play, RotateCcw, Settings } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/70"
      role="dialog"
      aria-modal="true"
      aria-label="Game Paused"
    >
      <div className="w-full max-w-sm bg-slate-950/95 border border-white/15 rounded-2xl p-6 shadow-2xl">
        <h2 className="font-display font-bold text-2xl text-white tracking-wide mb-1">
          Ride Paused
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Catch your breath or adjust your setup before resuming.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Resume</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <span>Restart Run</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-300" aria-hidden="true" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
