import React, { useEffect, useState } from 'react';
import { Check, Lock, X } from 'lucide-react';
import {
  BICYCLES,
  EFFECTS,
  ENVIRONMENTS,
  OUTFITS,
  SKINS,
} from '../game/catalog';
import { isItemUnlocked } from '../game/storage';
import type { PlayerSaveData, ShopCategory } from '../game/types';
import { CoinIcon } from './GameIcons';

interface ShopModalProps {
  saveData: PlayerSaveData;
  initialTab?: ShopCategory;
  onBuyOrEquip: (category: ShopCategory, itemId: string) => void;
  onClose: () => void;
}

const TABS: { id: ShopCategory; label: string }[] = [
  { id: 'bicycles', label: 'Bicycles' },
  { id: 'outfits', label: 'Outfits' },
  { id: 'skins', label: 'Bike Skins' },
  { id: 'effects', label: 'Trail FX' },
  { id: 'environments', label: 'Routes' },
];

export const ShopModal: React.FC<ShopModalProps> = ({
  saveData,
  initialTab = 'bicycles',
  onBuyOrEquip,
  onClose,
}) => {
  const [tab, setTab] = useState<ShopCategory>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const getEquippedId = (cat: ShopCategory): string => {
    switch (cat) {
      case 'bicycles':
        return saveData.equippedBicycle;
      case 'outfits':
        return saveData.equippedOutfit;
      case 'skins':
        return saveData.equippedSkin;
      case 'effects':
        return saveData.equippedEffect;
      case 'environments':
        return saveData.equippedEnvironment;
    }
  };

  const renderCards = () => {
    const equippedId = getEquippedId(tab);

    if (tab === 'bicycles') {
      return BICYCLES.map((bike) => {
        const unlocked = isItemUnlocked(saveData, 'bicycles', bike.id);
        const equipped = equippedId === bike.id;
        const canAfford = saveData.coins >= bike.cost;
        return (
          <div
            key={bike.id}
            className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
              equipped
                ? 'bg-slate-900 border-amber-400/70'
                : 'bg-slate-900/70 border-white/10'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  {bike.name}
                </h3>
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
                  style={{ backgroundColor: bike.accentHex }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{bike.subtitle}</p>

              <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                <div className="bg-slate-950/70 rounded-lg px-2 py-1.5">
                  <div className="text-slate-400">Speed</div>
                  <div className="font-mono-tabular font-bold text-cyan-300">
                    {Math.round(bike.speedBonus * 100)}%
                  </div>
                </div>
                <div className="bg-slate-950/70 rounded-lg px-2 py-1.5">
                  <div className="text-slate-400">Handling</div>
                  <div className="font-mono-tabular font-bold text-emerald-300">
                    {Math.round(bike.handlingBonus * 100)}%
                  </div>
                </div>
                <div className="bg-slate-950/70 rounded-lg px-2 py-1.5">
                  <div className="text-slate-400">Jump</div>
                  <div className="font-mono-tabular font-bold text-amber-300">
                    {Math.round(bike.jumpBonus * 100)}%
                  </div>
                </div>
              </div>
            </div>

            <ItemActionButton
              unlocked={unlocked}
              equipped={equipped}
              cost={bike.cost}
              canAfford={canAfford}
              onClick={() => onBuyOrEquip('bicycles', bike.id)}
              labelPrefix={bike.name}
            />
          </div>
        );
      });
    }

    if (tab === 'outfits') {
      return OUTFITS.map((outfit) => {
        const unlocked = isItemUnlocked(saveData, 'outfits', outfit.id);
        const equipped = equippedId === outfit.id;
        return (
          <div
            key={outfit.id}
            className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
              equipped
                ? 'bg-slate-900 border-amber-400/70'
                : 'bg-slate-900/70 border-white/10'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  {outfit.name}
                </h3>
                <div className="flex items-center gap-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ backgroundColor: outfit.jerseyHex }}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ backgroundColor: outfit.jerseyStripeHex }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">{outfit.subtitle}</p>
            </div>
            <ItemActionButton
              unlocked={unlocked}
              equipped={equipped}
              cost={outfit.cost}
              canAfford={saveData.coins >= outfit.cost}
              onClick={() => onBuyOrEquip('outfits', outfit.id)}
              labelPrefix={outfit.name}
            />
          </div>
        );
      });
    }

    if (tab === 'skins') {
      return SKINS.map((skin) => {
        const unlocked = isItemUnlocked(saveData, 'skins', skin.id);
        const equipped = equippedId === skin.id;
        return (
          <div
            key={skin.id}
            className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
              equipped
                ? 'bg-slate-900 border-amber-400/70'
                : 'bg-slate-900/70 border-white/10'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  {skin.name}
                </h3>
                <div className="flex items-center gap-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ backgroundColor: skin.frameHex }}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ backgroundColor: skin.rimHex }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">{skin.subtitle}</p>
            </div>
            <ItemActionButton
              unlocked={unlocked}
              equipped={equipped}
              cost={skin.cost}
              canAfford={saveData.coins >= skin.cost}
              onClick={() => onBuyOrEquip('skins', skin.id)}
              labelPrefix={skin.name}
            />
          </div>
        );
      });
    }

    if (tab === 'effects') {
      return EFFECTS.map((eff) => {
        const unlocked = isItemUnlocked(saveData, 'effects', eff.id);
        const equipped = equippedId === eff.id;
        return (
          <div
            key={eff.id}
            className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
              equipped
                ? 'bg-slate-900 border-amber-400/70'
                : 'bg-slate-900/70 border-white/10'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  {eff.name}
                </h3>
                <div className="flex items-center gap-1">
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ backgroundColor: eff.trailHex }}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ backgroundColor: eff.secondaryHex }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">{eff.subtitle}</p>
            </div>
            <ItemActionButton
              unlocked={unlocked}
              equipped={equipped}
              cost={eff.cost}
              canAfford={saveData.coins >= eff.cost}
              onClick={() => onBuyOrEquip('effects', eff.id)}
              labelPrefix={eff.name}
            />
          </div>
        );
      });
    }

    return ENVIRONMENTS.map((env) => {
      const unlocked = isItemUnlocked(saveData, 'environments', env.id);
      const equipped = equippedId === env.id;
      return (
        <div
          key={env.id}
          className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
            equipped
              ? 'bg-slate-900 border-amber-400/70'
              : 'bg-slate-900/70 border-white/10'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-lg text-white">
                {env.name}
              </h3>
              <div
                className="w-10 h-4 rounded border border-white/20"
                style={{
                  background: `linear-gradient(90deg, ${env.skyTopHex}, ${env.accentHex})`,
                }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{env.subtitle}</p>
          </div>
          <ItemActionButton
            unlocked={unlocked}
            equipped={equipped}
            cost={env.cost}
            canAfford={saveData.coins >= env.cost}
            onClick={() => onBuyOrEquip('environments', env.id)}
            labelPrefix={env.name}
          />
        </div>
      );
    });
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75"
      role="dialog"
      aria-modal="true"
      aria-label="Garage and Shop"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-slate-950/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg sm:text-2xl text-white">
              Garage & Routes
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              Unlock and equip bicycles, rider kits, finishes, trail FX, and cycling worlds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-lg">
              <CoinIcon className="w-4 h-4" />
              <span
                data-testid="shop-coins"
                className="font-mono-tabular font-bold text-sm text-amber-300"
              >
                {saveData.coins.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Shop"
              className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-white/10 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="p-6 overflow-y-auto custom-scroll grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderCards()}
        </div>
      </div>
    </div>
  );
};

interface ItemActionButtonProps {
  unlocked: boolean;
  equipped: boolean;
  cost: number;
  canAfford: boolean;
  onClick: () => void;
  labelPrefix: string;
}

const ItemActionButton: React.FC<ItemActionButtonProps> = ({
  unlocked,
  equipped,
  cost,
  canAfford,
  onClick,
  labelPrefix,
}) => {
  if (equipped) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${labelPrefix} Equipped`}
        className="w-full py-2.5 px-3 rounded-lg bg-amber-500/15 border border-amber-400/50 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5"
      >
        <Check className="w-4 h-4" aria-hidden="true" />
        <span>Equipped</span>
      </button>
    );
  }

  if (unlocked) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Equip ${labelPrefix}`}
        className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
      >
        Equip
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!canAfford}
      onClick={onClick}
      aria-label={`Unlock ${labelPrefix} for ${cost} coins`}
      className={`w-full py-2.5 px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${
        canAfford
          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
          : 'bg-slate-900 border border-white/10 text-slate-500 cursor-not-allowed'
      }`}
    >
      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Unlock</span>
      <CoinIcon className="w-3.5 h-3.5 ml-1" />
      <span className="font-mono-tabular font-bold">{cost}</span>
    </button>
  );
};
