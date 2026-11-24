import React from 'react';
import {
  Award,
  Bike,
  ChevronRight,
  Map as MapIcon,
  Mountain,
  Play,
  Settings,
  ShoppingBag,
  Star,
  Target,
  Timer,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { ADVENTURE_CAMPAIGN_LEVELS, ADVENTURE_CHALLENGES } from '../game/adventureCatalog';
import { ENVIRONMENTS, MISSIONS, getBicycleSpec } from '../game/catalog';
import { getTotalAdventureStars } from '../game/storage';
import type { GameMode, PlayerSaveData } from '../game/types';
import { CoinIcon, CycleRushLogo } from './GameIcons';

interface TitleOverlayProps {
  saveData: PlayerSaveData;
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onStartGame: () => void;
  onOpenAdventure: () => void;
  onOpenShop: (initialTab?: 'bicycles' | 'environments') => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
}

const MODE_OPTIONS: {
  id: GameMode;
  label: string;
  sub: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'endless',
    label: 'Endless',
    sub: 'Survive & climb speed',
    Icon: InfinityIcon,
  },
  {
    id: 'time_challenge',
    label: 'Time Trial',
    sub: '90s score sprint',
    Icon: Timer,
  },
  {
    id: 'mission',
    label: 'Missions',
    sub: 'Complete objectives',
    Icon: Target,
  },
];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  saveData,
  selectedMode,
  onSelectMode,
  onStartGame,
  onOpenAdventure,
  onOpenShop,
  onOpenMissions,
  onOpenSettings,
}) => {
  const activeBike = getBicycleSpec(saveData.equippedBicycle);
  const activeEnv =
    ENVIRONMENTS.find((e) => e.id === saveData.equippedEnvironment) ??
    ENVIRONMENTS[0];
  const activeMission =
    MISSIONS.find((m) => m.id === saveData.activeMissionId) ?? MISSIONS[0];
  const unclaimedCount = saveData.completedMissions.filter(
    (id) => !saveData.claimedMissions.includes(id),
  ).length;
  const adventureStars = getTotalAdventureStars(saveData.adventure);
  const maxAdventureStars =
    (ADVENTURE_CAMPAIGN_LEVELS.length + ADVENTURE_CHALLENGES.length) * 3;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-5 sm:p-8 lg:p-10">
      {/* Left gradient scrim for clean contrast over live 3D cyclist showcase */}
      <div
        className="fixed inset-y-0 left-0 w-full md:w-[56%] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(6,10,19,0.88) 0%, rgba(6,10,19,0.68) 58%, rgba(6,10,19,0) 100%)',
        }}
      />

      {/* Top Strip: Stats summary & Settings button */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 text-sm text-slate-200 pointer-events-auto">
          <div className="flex items-center gap-2 bg-slate-950/85 border border-white/10 px-3.5 py-2 rounded-lg">
            <Award className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span className="text-slate-400 text-xs uppercase tracking-wider">Best</span>
            <span className="font-mono-tabular font-bold text-white">
              {saveData.bestScore.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/85 border border-white/10 px-3.5 py-2 rounded-lg">
            <CoinIcon className="w-4 h-4" />
            <span className="font-mono-tabular font-bold text-amber-300">
              {saveData.coins.toLocaleString()}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open Settings"
          className="pointer-events-auto flex items-center gap-2 bg-slate-950/85 hover:bg-slate-900 border border-white/15 hover:border-amber-400/50 text-slate-100 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-slate-300" aria-hidden="true" />
          <span className="hidden sm:inline whitespace-nowrap">Settings</span>
        </button>
      </div>

      {/* Main Left-Third Command Panel */}
      <div className="relative z-10 max-w-md w-full my-auto flex flex-col gap-5 pointer-events-auto">
        <div>
          <CycleRushLogo className="w-72 sm:w-80 h-auto mb-2" />
          <p className="text-slate-300 text-sm sm:text-base font-medium tracking-wide">
            Ride Fast. Dodge Smart. Power Through.
          </p>
        </div>

        {/* Mode Selector */}
        <div
          className="grid grid-cols-3 gap-2 bg-slate-950/85 p-1.5 rounded-xl border border-white/10"
          role="radiogroup"
          aria-label="Game Mode"
        >
          {MODE_OPTIONS.map(({ id, label, sub, Icon }) => {
            const active = selectedMode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelectMode(id)}
                className={`flex flex-col items-start p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-display font-bold text-sm whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </div>
                <span
                  className={`text-[11px] leading-tight mt-0.5 ${
                    active ? 'text-slate-900 font-medium' : 'text-slate-400'
                  }`}
                >
                  {sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Setup Summary */}
        <div className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/80 border border-white/10 rounded-lg px-3.5 py-2.5">
          <div className="flex items-center gap-2 truncate">
            <Bike className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-white">{activeBike.name}</span>
          </div>
          <span className="text-slate-600 px-2" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 truncate">
            <MapIcon className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-slate-200">{activeEnv.name}</span>
          </div>
        </div>

        {selectedMode === 'mission' && (
          <div className="bg-slate-950/85 border border-cyan-500/30 rounded-lg px-3.5 py-2.5 text-xs">
            <div className="flex items-center justify-between text-cyan-300 font-semibold mb-1">
              <span>Active Mission · {activeMission.title}</span>
              <span className="font-mono-tabular">
                {saveData.missionProgress[activeMission.id] ?? 0}/{activeMission.target}
              </span>
            </div>
            <p className="text-slate-400">{activeMission.description}</p>
          </div>
        )}

        {/* Primary Play CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStartGame}
          className="w-full flex items-center justify-between px-6 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display font-bold text-xl tracking-wide transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <span className="flex items-center gap-3">
            <Play className="w-6 h-6 fill-current" aria-hidden="true" />
            <span>PLAY NOW</span>
          </span>
          <ChevronRight className="w-6 h-6" aria-hidden="true" />
        </button>

        {/* Adventure Mode CTA */}
        <button
          type="button"
          data-adventure-open="true"
          onClick={onOpenAdventure}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-cyan-400/45 hover:border-cyan-300 text-white transition-all cursor-pointer"
        >
          <span className="flex items-center gap-3 text-left">
            <span className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-300 shrink-0">
              <Mountain className="w-5 h-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display font-bold text-base leading-tight text-cyan-200">
                ADVENTURE MODE
              </span>
              <span className="block text-[11px] text-slate-400">
                Cliffs, Stunt Park, Wheelies &amp; Mountain Trails
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-mono-tabular font-bold text-amber-300 shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>
              {adventureStars}/{maxAdventureStars}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </span>
        </button>

        {/* Secondary Garage / Environment / Missions Actions */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onOpenShop('bicycles')}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-white/15 hover:border-amber-400/50 text-sm font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Shop</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenShop('environments')}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-white/15 hover:border-cyan-400/50 text-sm font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <MapIcon className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
            <span>Routes</span>
          </button>
          <button
            type="button"
            onClick={onOpenMissions}
            className="relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-white/15 hover:border-emerald-400/50 text-sm font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Target className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>Missions</span>
            {unclaimedCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-500 text-slate-950 text-[11px] font-bold rounded">
                {unclaimedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Control Legend */}
      <div className="relative z-10 flex items-center justify-between text-xs text-slate-300/90">
        <p className="hud-text-stroke tracking-wide">
          A / D or ← / → Steer · W / ↑ Sprint · S / ↓ Brake · Space Jump · Esc Pause
        </p>
      </div>
    </div>
  );
};
