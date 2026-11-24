import React, { useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MISSIONS, POWERUP_META } from '../game/catalog';
import type { HudState } from '../game/types';
import { CoinIcon, PowerUpIcon } from './GameIcons';

interface GameHudProps {
  hud: HudState;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSwipe: (dir: -1 | 1) => void;
  onJump: () => void;
  onBrakeStart: () => void;
  onBrakeEnd: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onPause,
  onRestart,
  onSwipe,
  onJump,
  onBrakeStart,
  onBrakeEnd,
}) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const brakePulseTimer = useRef<number | null>(null);

  const speedPct = Math.min(1, hud.speedKmh / 90);
  const arcTotal = 150;
  const arcOffset = arcTotal * (1 - speedPct);

  const activeMission =
    MISSIONS.find((m) => m.id === hud.activeMissionId) ?? MISSIONS[0];

  const bannerColors: Record<string, string> = {
    gold: 'text-amber-300 border-amber-400/50 bg-slate-950/90',
    cyan: 'text-cyan-300 border-cyan-400/50 bg-slate-950/90',
    emerald: 'text-emerald-300 border-emerald-400/50 bg-slate-950/90',
    amber: 'text-orange-300 border-orange-400/50 bg-slate-950/90',
    rose: 'text-rose-300 border-rose-400/50 bg-slate-950/90',
  };

  return (
    <div
      data-testid="hud-touch-surface"
      className="fixed inset-0 z-10 pointer-events-auto touch-none flex flex-col justify-between p-3.5 sm:p-6"
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }
      }}
      onTouchMove={(e) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const dx = cx - touchStartX.current;
        const dy = cy - touchStartY.current;
        if (Math.abs(dx) > 34) {
          onSwipe(dx < 0 ? -1 : 1);
          touchStartX.current = cx;
          touchStartY.current = cy;
        } else if (dy < -42) {
          onJump();
          touchStartX.current = cx;
          touchStartY.current = cy;
        } else if (dy > 44) {
          onBrakeStart();
          if (brakePulseTimer.current !== null) window.clearTimeout(brakePulseTimer.current);
          brakePulseTimer.current = window.setTimeout(() => onBrakeEnd(), 380);
          touchStartY.current = cy;
        }
      }}
      onTouchEnd={() => {
        touchStartX.current = null;
        touchStartY.current = null;
      }}
    >
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left: Score, Multiplier, Distance, Difficulty / Mode Clock */}
        <div className="flex flex-col gap-1 sm:gap-1.5 bg-slate-950/82 border border-white/10 rounded-xl px-3 py-2 sm:px-4 sm:py-3 min-w-0 sm:min-w-[190px]">
          <div className="flex items-baseline justify-between gap-2 sm:gap-3">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Score
            </span>
            {hud.multiplier > 1 && (
              <span className="font-mono-tabular text-[10px] sm:text-xs font-bold text-amber-400">
                ×{hud.multiplier.toFixed(1).replace('.0', '')}
              </span>
            )}
          </div>
          <div
            data-testid="hud-score"
            className="font-display font-bold text-2xl sm:text-4xl leading-none text-white font-mono-tabular hud-text-stroke"
          >
            {hud.score.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-300 mt-0.5 sm:mt-1 whitespace-nowrap">
            <span data-testid="hud-distance" className="font-mono-tabular font-semibold text-cyan-300">
              {hud.distanceMeters >= 1000
                ? `${(hud.distanceMeters / 1000).toFixed(2)} km`
                : `${hud.distanceMeters} m`}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-300">Stg {hud.difficultyStage}</span>
            <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
            <span className="hidden sm:inline text-slate-400 font-mono-tabular">
              Best {hud.bestScore.toLocaleString()}
            </span>
          </div>

          {hud.mode === 'time_challenge' && (
            <div className="mt-1 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">Time Left</span>
              <span className="font-mono-tabular font-bold text-amber-400 text-sm">
                {hud.timeRemainingSeconds}s
              </span>
            </div>
          )}

          {hud.mode === 'mission' && (
            <div className="mt-1 pt-1.5 border-t border-white/10 text-xs">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="truncate max-w-[110px] sm:max-w-[130px]">{activeMission.title}</span>
                <span className="font-mono-tabular font-bold text-emerald-400">
                  {hud.activeMissionProgress}/{hud.activeMissionTarget}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{
                    width: `${Math.min(100, (hud.activeMissionProgress / hud.activeMissionTarget) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Coins + Square Utility Icon Buttons */}
        <div
          className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0"
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950/85 border border-white/10 rounded-xl px-2.5 py-2 sm:px-3.5 sm:py-2.5">
            <CoinIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span
              data-testid="hud-coins"
              className="font-mono-tabular font-bold text-sm sm:text-lg text-amber-300 leading-none"
            >
              {hud.coinsRun}
            </span>
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-white/15 text-slate-200 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Restart Run"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-white/15 text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Game"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-white/15 text-slate-200 transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Center-Top Event Banner (never blocks view) */}
      {hud.banner && (
        <div
          key={hud.banner.id}
          className="self-center -mt-20 pointer-events-none animate-float-banner"
        >
          <div
            className={`px-4 py-1.5 rounded-lg border font-display font-bold text-base sm:text-lg tracking-wider ${
              bannerColors[hud.banner.tone] ?? bannerColors.gold
            }`}
          >
            {hud.banner.text}
          </div>
        </div>
      )}

      {/* Bottom Perimeter: Speedometer + Active Power-Ups + Mobile Touch Controls */}
      <div className="flex items-end justify-between gap-3 sm:gap-4">
        <div className="flex flex-col-reverse sm:flex-row items-start sm:items-end gap-2 sm:gap-3 min-w-0">
          {/* Speedometer Gauge */}
          <div className="bg-slate-950/85 border border-white/10 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 sm:gap-3 shrink-0">
            <svg viewBox="0 0 80 54" className="w-14 h-10 sm:w-16 sm:h-11 shrink-0" aria-hidden="true">
              <path
                d="M 10 46 A 30 30 0 0 1 70 46"
                fill="none"
                stroke="#1E293B"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d="M 10 46 A 30 30 0 0 1 70 46"
                fill="none"
                stroke={hud.speedKmh > 65 ? '#F59E0B' : '#22D3EE'}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={arcTotal}
                strokeDashoffset={arcOffset}
              />
            </svg>
            <div>
              <div
                data-testid="hud-speed"
                className="font-display font-bold text-xl sm:text-2xl leading-none text-white font-mono-tabular"
              >
                {hud.speedKmh}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                KM/H
              </div>
            </div>
          </div>

          {/* Active Power-Up Indicators */}
          {hud.activePowerUps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {hud.activePowerUps.map((p) => {
                const meta = POWERUP_META[p.type];
                const pct = Math.max(0, Math.min(100, (p.remaining / p.duration) * 100));
                return (
                  <div
                    key={p.type}
                    data-testid={`hud-powerup-${p.type}`}
                    className="bg-slate-950/88 border border-white/15 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center gap-2 min-w-[108px] sm:min-w-[122px]"
                  >
                    <PowerUpIcon type={p.type} className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-white leading-none">
                        <span>
                          {meta.shortLabel}
                          {p.type === 'shield' && hud.shieldCharges > 0
                            ? ` (${hud.shieldCharges}×)`
                            : ''}
                        </span>
                        <span className="font-mono-tabular text-slate-300 ml-1">
                          {p.remaining.toFixed(1)}s
                        </span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: meta.colorHex,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Touch Controls (shown on touch/small screens) */}
        <div className="flex md:hidden items-center gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            aria-label="Brake"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBrakeStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBrakeEnd();
            }}
            onTouchCancel={onBrakeEnd}
            onMouseDown={onBrakeStart}
            onMouseUp={onBrakeEnd}
            onMouseLeave={onBrakeEnd}
            className="w-12 h-12 rounded-xl bg-slate-950/90 active:bg-rose-600 border border-white/20 flex items-center justify-center text-slate-100"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Jump"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onJump();
            }}
            onClick={onJump}
            className="w-14 h-12 rounded-xl bg-amber-500 active:bg-amber-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-1 shadow-lg"
          >
            <ArrowUp className="w-4 h-4" />
            <span>HOP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
