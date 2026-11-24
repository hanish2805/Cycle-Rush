import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flag,
  Home,
  RotateCcw,
  Star,
  Trophy,
} from 'lucide-react';
import { getNextAdventureLevel } from '../game/adventureCatalog';
import type { AdventureCrashReason, AdventureRunSnapshot } from '../game/types';
import { CoinIcon } from './GameIcons';

interface AdventureResultModalProps {
  snapshot: AdventureRunSnapshot;
  onResumeCheckpoint: () => void;
  onRestartLevel: () => void;
  onNextLevel: (nextLevelId: string) => void;
  onBackToHub: () => void;
  onMainMenu: () => void;
}

const CRASH_LABELS: Record<AdventureCrashReason, { title: string; hint: string }> = {
  crash_landing: {
    title: 'Bad Landing Angle',
    hint: 'Level your bike pitch with ↑/↓ before touchdown.',
  },
  crash_wheelie: {
    title: 'Wheelie Looped Out',
    hint: 'Feather Wheelie [Q] inside the green balance zone.',
  },
  crash_stoppie: {
    title: 'Stoppie Endo Crash',
    hint: 'Ease off [E] before pitching forward past the nose limit.',
  },
  crash_cliff: {
    title: 'Trail Drop-Off',
    hint: 'Steer inside cliff ridges and launch kickers at full speed.',
  },
  crash_obstacle: {
    title: 'Trail Obstacle Crash',
    hint: 'Carve wide around boulders, logs and arena barriers.',
  },
};

export const AdventureResultModal: React.FC<AdventureResultModalProps> = ({
  snapshot,
  onResumeCheckpoint,
  onRestartLevel,
  onNextLevel,
  onBackToHub,
  onMainMenu,
}) => {
  const isCrash = snapshot.outcome === 'crashed';
  const crashInfo = snapshot.crashReason
    ? CRASH_LABELS[snapshot.crashReason]
    : { title: 'Wipeout', hint: 'Recover cleanly from your last checkpoint.' };
  const nextLevel = !snapshot.isChallenge
    ? getNextAdventureLevel(snapshot.levelId)
    : null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/80"
      role="dialog"
      aria-modal="true"
      aria-label={isCrash ? 'Adventure Crash Recovery' : 'Adventure Level Complete'}
    >
      <div className="w-full max-w-md bg-slate-950/95 border border-white/15 rounded-2xl p-6 shadow-2xl">
        {isCrash ? (
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-display font-bold text-2xl text-white">
              {crashInfo.title}
            </h2>
            <p className="text-xs text-slate-300 mt-1">{crashInfo.hint}</p>
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-300 bg-slate-900 px-3 py-1 rounded-full border border-white/10">
              <Flag className="w-3.5 h-3.5" />
              <span>
                {snapshot.distanceMeters}/{snapshot.totalLengthMeters}m · Checkpoint{' '}
                {snapshot.checkpointIndex}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
              <Trophy className="w-4 h-4" />
              <span>{snapshot.isNewBestScore ? 'New Level Record!' : 'Course Cleared'}</span>
            </div>
            <h2 className="font-display font-bold text-2xl text-white">
              {snapshot.levelTitle}
            </h2>

            {/* 3-Star Rating */}
            <div className="flex items-center justify-center gap-2.5 my-3">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`w-8 h-8 ${
                    s <= snapshot.starsEarned
                      ? 'text-amber-400 fill-amber-400 drop-shadow'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stats Breakdown */}
        <div className="grid grid-cols-2 gap-2.5 text-xs mb-4">
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400 uppercase text-[10px]">Total Score</div>
            <div className="font-mono-tabular font-bold text-lg text-white">
              {snapshot.totalScore.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400 uppercase text-[10px]">Stunt Score</div>
            <div className="font-mono-tabular font-bold text-lg text-amber-300">
              {snapshot.stuntScore.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400 uppercase text-[10px]">Time / Par Target</div>
            <div className="font-mono-tabular font-bold text-sm text-cyan-300">
              {snapshot.elapsedSeconds.toFixed(1)}s{' '}
              <span className={snapshot.parTimeBeaten ? 'text-emerald-400' : 'text-slate-400'}>
                / {snapshot.parTimeSeconds}s
              </span>
            </div>
          </div>
          <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3">
            <div className="text-slate-400 uppercase text-[10px]">Best Jump · Wheelie</div>
            <div className="font-mono-tabular font-bold text-sm text-amber-300">
              {snapshot.longestJumpMeters.toFixed(1)}m · {snapshot.longestWheelieSeconds.toFixed(1)}s
            </div>
          </div>
          <div className="col-span-2 bg-slate-900/90 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="text-slate-400 uppercase text-[10px]">Coins Awarded</div>
            <div className="flex items-center gap-1.5 font-mono-tabular font-bold text-sm text-amber-300">
              <CoinIcon className="w-4 h-4" />
              <span>+{snapshot.coinsAwarded}</span>
            </div>
          </div>
        </div>

        {!isCrash && (
          <div
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs mb-5 ${
              snapshot.objectiveCompleted
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-slate-900/80 border-white/10 text-slate-300'
            }`}
          >
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                snapshot.objectiveCompleted ? 'text-emerald-400' : 'text-slate-500'
              }`}
            />
            <span>{snapshot.objectiveLabel}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          {isCrash ? (
            <button
              type="button"
              onClick={onResumeCheckpoint}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base cursor-pointer"
            >
              <Flag className="w-4 h-4" />
              <span>
                {snapshot.checkpointIndex > 0
                  ? `Restart from Checkpoint ${snapshot.checkpointIndex}`
                  : 'Resume from Start'}
              </span>
            </button>
          ) : (
            nextLevel && (
              <button
                type="button"
                onClick={() => onNextLevel(nextLevel.id)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base cursor-pointer"
              >
                <span>Next: {nextLevel.title}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onRestartLevel}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-100 font-semibold text-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <span>Restart Level</span>
            </button>
            <button
              type="button"
              onClick={onBackToHub}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-100 font-semibold text-sm cursor-pointer"
            >
              <span>Level Select</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
