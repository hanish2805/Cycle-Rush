import React, { useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Compass,
  Eye,
  Flame,
  Lock,
  Mountain,
  Play,
  RotateCcw,
  Star,
  Trophy,
} from 'lucide-react';
import {
  ADVENTURE_AREAS,
  ADVENTURE_CAMPAIGN_LEVELS,
  ADVENTURE_CHALLENGES,
  getAdventureAreaSpec,
  getAdventureLevelDef,
} from '../game/adventureCatalog';
import { getTotalAdventureStars } from '../game/storage';
import type { AdventureAreaId, PlayerSaveData } from '../game/types';
import { CoinIcon } from './GameIcons';

interface AdventureHubModalProps {
  saveData: PlayerSaveData;
  previewAreaId: AdventureAreaId;
  onSelectPreviewArea: (areaId: AdventureAreaId) => void;
  onStartLevel: (levelId: string) => void;
  onNewAdventure: () => void;
  onBack: () => void;
}

export const AdventureHubModal: React.FC<AdventureHubModalProps> = ({
  saveData,
  previewAreaId,
  onSelectPreviewArea,
  onStartLevel,
  onNewAdventure,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'levels' | 'challenges'>('levels');
  const adv = saveData.adventure;
  const totalStars = getTotalAdventureStars(adv);
  const maxStars = (ADVENTURE_CAMPAIGN_LEVELS.length + ADVENTURE_CHALLENGES.length) * 3;
  const continueLevel = getAdventureLevelDef(adv.currentLevelId);
  const previewArea = getAdventureAreaSpec(previewAreaId);

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Adventure Mode Hub"
    >
      {/* Left dark scrim preserving open live 3D environment preview on right side on desktop */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.72) 50%, rgba(2,6,23,0.08) 100%)',
        }}
      />

      {/* Top Navigation & Adventure Career Stats */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-slate-100 text-sm font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest">
              <Mountain className="w-4 h-4" />
              <span>Adventure Mode</span>
            </div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-white">
              Mountain &amp; Stunt Expeditions
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-white/15 px-3 py-2 rounded-lg">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Best Score</span>
            <span className="font-mono-tabular font-bold text-white">
              {adv.bestAdventureScore.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-white/15 px-3 py-2 rounded-lg">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-slate-400">Stars</span>
            <span className="font-mono-tabular font-bold text-amber-300">
              {totalStars}/{maxStars}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-white/15 px-3 py-2 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Completed</span>
            <span className="font-mono-tabular font-bold text-emerald-300">
              {adv.completedLevels.length}/{ADVENTURE_CAMPAIGN_LEVELS.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-white/15 px-3 py-2 rounded-lg">
            <CoinIcon className="w-4 h-4" />
            <span className="font-mono-tabular font-bold text-amber-300">
              {saveData.coins.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Center Content Split: Left Control & Level Deck + Right Live 3D Preview Info */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 my-auto py-2">
        {/* Left column: Quick Actions + Tabs + Level/Challenge Cards */}
        <div className="lg:col-span-7 xl:col-span-6 flex flex-col gap-3 bg-slate-950/95 border border-white/15 rounded-2xl p-3.5 sm:p-4">
          {/* Primary Continue / New Adventure Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              data-adventure-continue="true"
              onClick={() => onStartLevel(continueLevel.id)}
              className="sm:col-span-2 flex items-center justify-between px-4 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 text-left">
                <Play className="w-5 h-5 fill-current shrink-0" />
                <span>
                  <span className="block text-[11px] uppercase tracking-wider opacity-80">
                    Continue Adventure
                  </span>
                  <span className="block leading-tight">{continueLevel.title}</span>
                </span>
              </span>
              <span className="text-xs font-mono-tabular bg-slate-950/15 px-2 py-1 rounded">
                {continueLevel.lengthMeters}m
              </span>
            </button>

            <button
              type="button"
              onClick={onNewAdventure}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 hover:border-cyan-400/50 text-slate-100 font-display font-bold text-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <span>New Adventure</span>
            </button>
          </div>

          {/* Section Switcher: Level Selection vs Stunt Challenges */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('levels')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'levels'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Level Selection ({ADVENTURE_CAMPAIGN_LEVELS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('challenges')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'challenges'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>Stunt Challenges ({ADVENTURE_CHALLENGES.length})</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
              <span>Best Stunt: <strong className="text-amber-300 font-mono-tabular">{adv.bestStuntScore}</strong></span>
              <span>Best Combo: <strong className="text-cyan-300 font-mono-tabular">{adv.bestComboCount}×</strong></span>
            </div>
          </div>

          {/* Cards Grid */}
          {activeTab === 'levels' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[42vh] lg:max-h-[54vh] overflow-y-auto pr-1 custom-scroll">
              {ADVENTURE_CAMPAIGN_LEVELS.map((lvl) => {
                const area = getAdventureAreaSpec(lvl.areaId);
                const unlocked = lvl.index <= adv.unlockedLevelIndex;
                const stars = adv.starsByLevel[lvl.id] ?? 0;
                const best = adv.bestScoreByLevel[lvl.id] ?? 0;
                const isDone = adv.completedLevels.includes(lvl.id);
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    disabled={!unlocked}
                    onMouseEnter={() => onSelectPreviewArea(lvl.areaId)}
                    onClick={() => unlocked && onStartLevel(lvl.id)}
                    className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-colors ${
                      unlocked
                        ? 'bg-slate-900 hover:bg-slate-800 border-white/15 hover:border-amber-400/60 cursor-pointer'
                        : 'bg-slate-900/95 border-white/10 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1"
                          style={{
                            backgroundColor: `${area.accentHex}22`,
                            color: area.accentHex,
                          }}
                        >
                          {area.name}
                        </span>
                        <div className="font-display font-bold text-sm text-white">
                          {lvl.title}
                        </div>
                      </div>

                      {!unlocked ? (
                        <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-1" />
                      ) : (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= stars
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">
                      {lvl.objective.label}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2 pt-2 border-t border-white/10">
                      <span className="font-mono-tabular">
                        {lvl.lengthMeters}m · +{lvl.coinReward}c
                      </span>
                      <span className="font-mono-tabular text-amber-300">
                        {best > 0 ? `Best ${best.toLocaleString()}` : isDone ? 'Cleared' : unlocked ? 'Play →' : 'Locked'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[42vh] lg:max-h-[54vh] overflow-y-auto pr-1 custom-scroll">
              {ADVENTURE_CHALLENGES.map((ch) => {
                const area = getAdventureAreaSpec(ch.areaId);
                const stars = adv.starsByLevel[ch.id] ?? 0;
                const best = adv.bestScoreByLevel[ch.id] ?? 0;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onMouseEnter={() => onSelectPreviewArea(ch.areaId)}
                    onClick={() => onStartLevel(ch.id)}
                    className="flex flex-col justify-between p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 hover:border-cyan-400/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1"
                          style={{
                            backgroundColor: `${area.accentHex}22`,
                            color: area.accentHex,
                          }}
                        >
                          {area.name}
                        </span>
                        <div className="font-display font-bold text-sm text-white">
                          {ch.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= stars
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-cyan-300 mt-1.5 font-medium">
                      {ch.objective.label}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2 pt-2 border-t border-white/10">
                      <span className="font-mono-tabular">
                        {ch.lengthMeters}m · +{ch.coinReward}c
                      </span>
                      <span className="font-mono-tabular text-amber-300">
                        {best > 0 ? `Best ${best.toLocaleString()}` : 'Start Challenge →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Compact Live 3D Preview + Stunt Records at top so cyclist stays unobstructed below */}
        <div className="lg:col-span-5 xl:col-span-6 flex flex-col justify-start gap-2.5 pointer-events-none">
          <div className="pointer-events-auto bg-slate-950/90 border border-white/15 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
                <Eye className="w-3.5 h-3.5" />
                <span>Live 3D Terrain Preview</span>
              </div>
              <span className="text-[11px] text-slate-400">{previewArea.difficultyLabel}</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {ADVENTURE_AREAS.map((area) => {
                const selected = area.id === previewAreaId;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => onSelectPreviewArea(area.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      selected
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10'
                    }`}
                  >
                    {area.name}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-display font-bold text-white">
                {previewArea.name}
              </div>
              <p className="text-[11px] text-slate-300">{previewArea.subtitle}</p>
            </div>
          </div>

          {/* Compact Stunt Records Bar */}
          <div className="pointer-events-auto bg-slate-950/90 border border-white/15 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                <Award className="w-3.5 h-3.5" />
                <span>Adventure Stunt Records</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900 rounded-lg py-1.5 px-2 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase">Longest Wheelie</div>
                <div className="font-mono-tabular font-bold text-xs sm:text-sm text-white">
                  {adv.longestWheelieSeconds.toFixed(1)}s
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg py-1.5 px-2 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase">Longest Jump</div>
                <div className="font-mono-tabular font-bold text-xs sm:text-sm text-cyan-300">
                  {adv.longestJumpMeters.toFixed(1)}m
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg py-1.5 px-2 border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase">Highest Air</div>
                <div className="font-mono-tabular font-bold text-xs sm:text-sm text-amber-300">
                  {adv.highestJumpMeters.toFixed(1)}m
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls Reference */}
      <div className="relative z-10 text-xs text-slate-300 hud-text-stroke flex flex-wrap items-center justify-between gap-2">
        <span>
          W/S Accel &amp; Brake · A/D Steer · Q Wheelie · M Manual · E Stoppie · Space Jump / Air Trick · Arrow Keys Flip &amp; 360° Spin · R Checkpoint · C Camera
        </span>
      </div>
    </div>
  );
};
