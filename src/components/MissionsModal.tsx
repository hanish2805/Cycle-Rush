import React from 'react';
import { CheckCircle2, Target, X } from 'lucide-react';
import { MISSIONS } from '../game/catalog';
import type { PlayerSaveData } from '../game/types';
import { CoinIcon } from './GameIcons';

interface MissionsModalProps {
  saveData: PlayerSaveData;
  onSelectMission: (missionId: string) => void;
  onClaimReward: (missionId: string) => void;
  onClose: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  saveData,
  onSelectMission,
  onClaimReward,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75"
      role="dialog"
      aria-modal="true"
      aria-label="Cycling Missions"
    >
      <div className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="font-display font-bold text-2xl text-white">
              Cycling Missions
            </h2>
            <p className="text-xs text-slate-400">
              Complete objectives across runs to earn bonus coin payouts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Missions"
            className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto custom-scroll flex flex-col gap-3">
          {MISSIONS.map((m) => {
            const progress = Math.min(m.target, saveData.missionProgress[m.id] ?? 0);
            const completed = saveData.completedMissions.includes(m.id);
            const claimed = saveData.claimedMissions.includes(m.id);
            const active = saveData.activeMissionId === m.id;
            const pct = Math.round((progress / m.target) * 100);

            return (
              <div
                key={m.id}
                className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  active
                    ? 'bg-slate-900 border-cyan-400/50'
                    : 'bg-slate-900/65 border-white/10'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Target
                      className={`w-4 h-4 shrink-0 ${
                        completed ? 'text-emerald-400' : 'text-cyan-400'
                      }`}
                      aria-hidden="true"
                    />
                    <h3 className="font-display font-bold text-base text-white">
                      {m.title}
                    </h3>
                    {active && !completed && (
                      <span className="text-[11px] font-semibold text-cyan-300">
                        · Tracked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{m.description}</p>

                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          completed ? 'bg-emerald-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-slate-300 shrink-0">
                      {progress} / {m.target}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-950/80 border border-white/10 px-3 py-2 rounded-lg text-xs font-mono-tabular font-bold text-amber-300">
                    <CoinIcon className="w-4 h-4" />
                    <span>+{m.rewardCoins}</span>
                  </div>

                  {completed && !claimed ? (
                    <button
                      type="button"
                      onClick={() => onClaimReward(m.id)}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs cursor-pointer"
                    >
                      Claim
                    </button>
                  ) : claimed ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 px-2">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      Claimed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectMission(m.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {active ? 'Active' : 'Track'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
