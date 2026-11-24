import React from 'react';
import {
  Camera,
  CheckCircle2,
  Flag,
  Flame,
  Gauge,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { AdventureInputState } from '../game/adventurePhysics';
import type { AdventureHudState } from '../game/types';

interface AdventureHudProps {
  hud: AdventureHudState;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestartCheckpoint: () => void;
  onCycleCamera: () => void;
  onTouchInput: (patch: Partial<AdventureInputState>) => void;
}

const TONE_CLASSES: Record<AdventureHudState['alertTone'], string> = {
  gold: 'bg-amber-500 text-slate-950 border-amber-300',
  cyan: 'bg-cyan-500 text-slate-950 border-cyan-300',
  emerald: 'bg-emerald-500 text-slate-950 border-emerald-300',
  amber: 'bg-orange-500 text-slate-950 border-orange-300',
  rose: 'bg-rose-600 text-white border-rose-400',
};

export const AdventureHud: React.FC<AdventureHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onPause,
  onRestartCheckpoint,
  onCycleCamera,
  onTouchInput,
}) => {
  const progressPct = Math.min(
    100,
    Math.round((hud.distanceMeters / Math.max(1, hud.totalLengthMeters)) * 100),
  );
  // Map balanceValue (-1..+1) -> percentage across gauge bar (0%..100%)
  const needlePct = Math.max(2, Math.min(98, ((hud.balanceValue + 1) * 0.5) * 100));
  const inDanger = Math.abs(hud.balanceValue) > 0.78;
  const inSweetSpot = Math.abs(hud.balanceValue) >= 0.2 && Math.abs(hud.balanceValue) <= 0.78;

  const holdBtn = (patchOn: Partial<AdventureInputState>, patchOff: Partial<AdventureInputState>) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInput(patchOn);
    },
    onPointerUp: () => onTouchInput(patchOff),
    onPointerLeave: () => onTouchInput(patchOff),
    onPointerCancel: () => onTouchInput(patchOff),
  });

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between gap-2.5">
        {/* Top Left: Speed, Distance, Checkpoints & Surface */}
        <div className="flex flex-col gap-1 sm:gap-1.5 bg-slate-950/85 border border-white/15 rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 min-w-[140px] sm:min-w-[215px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="font-mono-tabular font-bold text-base sm:text-xl text-white">
                {hud.speedKmh}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">km/h</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-white/10">
              {hud.surface}
            </span>
          </div>

          {/* Course Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono-tabular gap-1.5">
            <span>
              {hud.distanceMeters}/{hud.totalLengthMeters}m
            </span>
            <span className="text-slate-400">
              {hud.elapsedSeconds.toFixed(1)}s/{hud.parTimeSeconds}s
            </span>
            <span className="flex items-center gap-1 text-cyan-300 font-semibold">
              <Flag className="w-3 h-3" />
              CP {hud.checkpointIndex}/{hud.checkpointsTotal}
            </span>
          </div>
        </div>

        {/* Top Center: Level Objective & Live Stunt Alert */}
        <div className="hidden md:flex flex-col items-center gap-2 max-w-sm">
          <div className="flex items-center gap-2 bg-slate-950/85 border border-white/15 rounded-xl px-3.5 py-2 text-xs">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                hud.objectiveCompleted ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <span className="text-slate-200 font-medium truncate">{hud.objectiveLabel}</span>
            <span className="font-mono-tabular font-bold text-cyan-300 shrink-0">
              {hud.objectiveProgress}/{hud.objectiveTarget}
            </span>
          </div>

          {hud.tutorialHint && (
            <div className="bg-slate-950/90 border border-cyan-400/35 rounded-lg px-3 py-1 text-[11px] font-medium text-cyan-200 text-center shadow">
              {hud.tutorialHint}
            </div>
          )}

          {hud.alertText && (
            <div
              className={`px-4 py-1.5 rounded-full border font-display font-bold text-sm tracking-wide shadow-lg ${
                TONE_CLASSES[hud.alertTone]
              }`}
            >
              {hud.alertText}
            </div>
          )}
        </div>

        {/* Top Right: Stunt Score, Combo & Quick Controls */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-col-reverse sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2">
            <div className="bg-slate-950/85 border border-white/15 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-right whitespace-nowrap">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Score · Stunts
              </div>
              <div className="font-mono-tabular font-bold text-sm sm:text-lg text-white leading-tight">
                {hud.totalScore.toLocaleString()}{' '}
                <span className="text-xs text-amber-400">({hud.stuntScore})</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={onCycleCamera}
                aria-label="Switch Camera"
                title={`Camera: ${hud.cameraMode} [C]`}
                className="flex items-center gap-1 h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-white/15 text-xs font-semibold text-cyan-300 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline uppercase">{hud.cameraMode}</span>
              </button>
              <button
                type="button"
                onClick={onRestartCheckpoint}
                aria-label="Reset to Checkpoint"
                title="Reset to Checkpoint [R]"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onPause}
                aria-label="Pause Adventure"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {hud.comboCount > 0 && (
            <div className="bg-amber-500/95 text-slate-950 px-3 py-1 rounded-lg font-display font-bold text-xs flex items-center gap-2 shadow">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>
                {hud.comboCount}× COMBO · +{hud.comboPointsPending}
              </span>
              <div className="w-12 h-1.5 bg-slate-950/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-950"
                  style={{ width: `${Math.round(hud.comboTimerRatio * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Compact Alert & Tutorial Banner */}
      {(hud.alertText || hud.tutorialHint) && (
        <div className="md:hidden self-center my-1 flex flex-col items-center gap-1 max-w-[92vw]">
          {hud.tutorialHint && (
            <div className="bg-slate-950/90 border border-cyan-400/35 rounded-lg px-2.5 py-1 text-[10px] font-medium text-cyan-200 text-center">
              {hud.tutorialHint}
            </div>
          )}
          {hud.alertText && (
            <div
              className={`px-3.5 py-1 rounded-full border font-display font-bold text-xs shadow ${
                TONE_CLASSES[hud.alertTone]
              }`}
            >
              {hud.alertText}
            </div>
          )}
        </div>
      )}

      {/* Bottom Perimeter: Balance Gauge + Boost Meter + Mobile Touch Controls */}
      <div className="flex flex-col gap-2.5">
        {/* Center Balance & Airborne Telemetry Strip */}
        <div className="self-center flex flex-wrap items-center justify-center gap-3 bg-slate-950/85 border border-white/15 rounded-xl px-4 py-2">
          {/* Balance Gauge (-1 Stoppie .. 0 Level .. +1 Wheelie) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-cyan-300">Stoppie</span>
            <div className="relative w-32 sm:w-40 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
              {/* Green sweet spots */}
              <div className="absolute left-[14%] w-[24%] inset-y-0 bg-emerald-500/35" />
              <div className="absolute right-[14%] w-[24%] inset-y-0 bg-emerald-500/35" />
              {/* Center marker */}
              <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-0.5 bg-white/40" />
              {/* Live Needle */}
              <div
                className={`absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full transition-all duration-75 ${
                  inDanger
                    ? 'bg-rose-500'
                    : inSweetSpot
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                }`}
                style={{ left: `${needlePct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold uppercase text-amber-300">Wheelie</span>
          </div>

          {hud.balanceMode !== 'none' && (
            <span className="text-xs font-mono-tabular font-bold text-emerald-300">
              {hud.balanceMode.toUpperCase()} {hud.balanceDuration.toFixed(1)}s
            </span>
          )}

          {hud.isAirborne && (
            <span className="text-xs font-mono-tabular font-bold text-cyan-300">
              AIR {hud.airtimeSeconds.toFixed(2)}s
            </span>
          )}

          {/* Boost Energy */}
          <div className="flex items-center gap-1.5">
            <Zap className={`w-3.5 h-3.5 ${hud.isBoosting ? 'text-amber-400' : 'text-slate-400'}`} />
            <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.round(hud.boostCharge * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mobile Touch Controls (shown on touch / narrow screens < 1024px) */}
        <div className="flex lg:hidden items-end justify-between gap-2 pointer-events-auto">
          {/* Left Side: Steer & Balance */}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1">
              <button
                type="button"
                {...holdBtn({ wheelie: true }, { wheelie: false })}
                className="px-2 py-2 rounded-lg bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border border-white/15 text-[10px] font-bold text-amber-300"
              >
                WHEELIE
              </button>
              <button
                type="button"
                {...holdBtn({ manual: true }, { manual: false })}
                className="px-2 py-2 rounded-lg bg-slate-950/90 active:bg-emerald-500 active:text-slate-950 border border-white/15 text-[10px] font-bold text-emerald-300"
              >
                MANUAL
              </button>
              <button
                type="button"
                {...holdBtn({ stoppie: true, brake: true }, { stoppie: false, brake: false })}
                className="px-2 py-2 rounded-lg bg-slate-950/90 active:bg-cyan-500 active:text-slate-950 border border-white/15 text-[10px] font-bold text-cyan-300"
              >
                STOPPIE
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                {...holdBtn({ steerLeft: true, airYawLeft: true }, { steerLeft: false, airYawLeft: false })}
                className="w-16 h-12 rounded-xl bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border border-white/15 font-display font-bold text-sm text-white"
              >
                ← LEFT
              </button>
              <button
                type="button"
                {...holdBtn({ steerRight: true, airYawRight: true }, { steerRight: false, airYawRight: false })}
                className="w-16 h-12 rounded-xl bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border border-white/15 font-display font-bold text-sm text-white"
              >
                RIGHT →
              </button>
            </div>
          </div>

          {/* Right Side: Jump/Trick, Boost, Accel/Brake */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-1.5">
              <button
                type="button"
                {...holdBtn({ boost: true }, { boost: false })}
                className="px-3 py-2 rounded-lg bg-slate-950/90 active:bg-amber-500 active:text-slate-950 border border-amber-400/40 text-[11px] font-bold text-amber-300"
              >
                BOOST
              </button>
              <button
                type="button"
                {...holdBtn(
                  { jumpPressed: !hud.isAirborne, trickPressed: hud.isAirborne, trickHeld: true },
                  { jumpPressed: false, trickPressed: false, trickHeld: false },
                )}
                className="px-4 py-2 rounded-lg bg-amber-500 active:bg-amber-400 text-slate-950 font-display font-bold text-xs"
              >
                {hud.isAirborne ? 'TRICK' : 'JUMP'}
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                {...holdBtn({ brake: true, airPitchUp: true }, { brake: false, airPitchUp: false })}
                className="w-16 h-12 rounded-xl bg-slate-950/90 active:bg-rose-500 border border-white/15 font-display font-bold text-xs text-rose-300"
              >
                {hud.isAirborne ? 'FLIP ↑' : 'BRAKE'}
              </button>
              <button
                type="button"
                {...holdBtn({ accel: true, airPitchDown: true }, { accel: false, airPitchDown: false })}
                className="w-16 h-12 rounded-xl bg-emerald-500 active:bg-emerald-400 text-slate-950 font-display font-bold text-xs"
              >
                {hud.isAirborne ? 'FLIP ↓' : 'PEDAL'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
