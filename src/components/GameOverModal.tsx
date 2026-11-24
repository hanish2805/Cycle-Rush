import React from 'react';
import { Award, Home, RotateCcw, Trophy } from 'lucide-react';
import type { RunSnapshot } from '../game/types';
import { CoinIcon } from './GameIcons';

interface GameOverModalProps {
  snapshot: RunSnapshot;
  onRetry: () => void;
  onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  snapshot,
  onRetry,
  onMainMenu,
}) => {
  const isVictory = snapshot.outcome === 'finished';

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/75"
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? 'Stage Complete' : 'Run Summary'}
    >
      <div className="w-full max-w-md bg-slate-950/95 border border-white/15 rounded-2xl p-5 sm:p-7 shadow-2xl">
        {/* Header & New Record Celebration */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-wide">
              {isVictory ? 'Time Trial Complete' : 'Run Ended'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {snapshot.missionCompleted && snapshot.missionTitle
                ? `Mission Cleared: ${snapshot.missionTitle}`
                : `Reached Stage ${snapshot.difficultyStage} · Top Pace ${snapshot.topSpeedKmh} km/h`}
            </p>
          </div>
          {snapshot.isNewRecord && (
            <div className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg font-display font-bold text-xs tracking-wider shrink-0">
              <Trophy className="w-4 h-4" aria-hidden="true" />
              <span>NEW RECORD!</span>
            </div>
          )}
        </div>

        {/* Hero Score & Personal Best */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Final Score
            </div>
            <div className="font-display font-bold text-2xl sm:text-3xl text-white font-mono-tabular mt-0.5">
              {snapshot.score.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
              <Award className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>Personal Best</span>
            </div>
            <div className="font-display font-bold text-2xl sm:text-3xl text-amber-300 font-mono-tabular mt-0.5">
              {snapshot.bestScore.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Detailed Run Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-6 text-center">
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Distance</div>
            <div className="font-mono-tabular font-bold text-base text-cyan-300 mt-0.5">
              {snapshot.distanceMeters >= 1000
                ? `${(snapshot.distanceMeters / 1000).toFixed(2)} km`
                : `${snapshot.distanceMeters} m`}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Coins Earned</div>
            <div className="flex items-center justify-center gap-1 font-mono-tabular font-bold text-base text-amber-300 mt-0.5">
              <CoinIcon className="w-4 h-4" />
              <span>+{snapshot.coinsEarned}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Survival Time</div>
            <div className="font-mono-tabular font-bold text-base text-slate-100 mt-0.5">
              {snapshot.survivalSeconds}s
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onMainMenu}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-200 font-semibold text-sm transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Main Menu</span>
          </button>

          <button
            type="button"
            data-start="true"
            onClick={onRetry}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
