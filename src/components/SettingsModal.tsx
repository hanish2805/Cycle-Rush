import React, { useEffect, useState } from 'react';
import { Keyboard, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import {
  DEFAULT_ADVENTURE_CONTROLS,
  formatKeyCodeLabel,
} from '../game/adventureCatalog';
import type { AdventureControlsConfig, GameSettings } from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdate: (patch: Partial<GameSettings>) => void;
  onClose: () => void;
}

const CONTROL_FIELDS: { key: keyof AdventureControlsConfig; label: string }[] = [
  { key: 'accel', label: 'Accelerate' },
  { key: 'brake', label: 'Brake' },
  { key: 'left', label: 'Steer Left' },
  { key: 'right', label: 'Steer Right' },
  { key: 'jump', label: 'Jump / Trick' },
  { key: 'boost', label: 'Boost' },
  { key: 'wheelie', label: 'Wheelie' },
  { key: 'manual', label: 'Manual' },
  { key: 'stoppie', label: 'Stoppie' },
  { key: 'reset', label: 'Checkpoint Reset' },
  { key: 'camera', label: 'Camera View' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const [listeningKey, setListeningKey] = useState<keyof AdventureControlsConfig | null>(null);

  useEffect(() => {
    if (!listeningKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        onUpdate({
          adventureControls: {
            ...settings.adventureControls,
            [listeningKey]: e.code,
          },
        });
      }
      setListeningKey(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [listeningKey, settings.adventureControls, onUpdate]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-950/95 border border-white/15 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-2xl text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {/* Mute toggle */}
          <div className="flex items-center justify-between bg-slate-900/75 border border-white/10 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5">
              {settings.muted ? (
                <VolumeX className="w-5 h-5 text-rose-400" aria-hidden="true" />
              ) : (
                <Volume2 className="w-5 h-5 text-cyan-400" aria-hidden="true" />
              )}
              <span className="text-sm font-semibold text-white">Master Audio</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ muted: !settings.muted })}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                settings.muted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {settings.muted ? 'Muted' : 'Active'}
            </button>
          </div>

          {/* Music Volume */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="music-vol" className="font-medium text-slate-200">
                Music Volume
              </label>
              <span className="font-mono-tabular text-xs text-slate-400">
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
            <input
              id="music-vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => onUpdate({ musicVolume: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* SFX Volume */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="sfx-vol" className="font-medium text-slate-200">
                Sound Effects Volume
              </label>
              <span className="font-mono-tabular text-xs text-slate-400">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              id="sfx-vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => onUpdate({ sfxVolume: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Steering Sensitivity */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <label htmlFor="steer-sens" className="font-medium text-slate-200">
                Steering Sensitivity
              </label>
              <span className="font-mono-tabular text-xs text-amber-300">
                {settings.sensitivity.toFixed(1)}×
              </span>
            </div>
            <input
              id="steer-sens"
              type="range"
              min={0.6}
              max={1.6}
              step={0.1}
              value={settings.sensitivity}
              onChange={(e) => onUpdate({ sensitivity: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Customizable Adventure Controls */}
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3.5 text-xs text-slate-300">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Keyboard className="w-4 h-4 text-cyan-400" />
                <span>Adventure Controls (Click to Rebind)</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    adventureControls: { ...DEFAULT_ADVENTURE_CONTROLS },
                  })
                }
                className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Defaults</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CONTROL_FIELDS.map(({ key, label }) => {
                const isListening = listeningKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setListeningKey(key)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      isListening
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-950/80 border-white/10 hover:border-cyan-400/40 text-slate-300'
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    <span className="font-mono-tabular font-bold text-[11px] text-cyan-300 ml-2 shrink-0">
                      {isListening
                        ? 'PRESS KEY...'
                        : formatKeyCodeLabel(settings.adventureControls[key])}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
