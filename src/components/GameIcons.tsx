import React from 'react';
import type { PowerUpType } from '../game/types';

export const CycleRushLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 360 88"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Cycle Rush"
  >
    {/* Speed wheel crest */}
    <circle cx="38" cy="46" r="24" stroke="#F59E0B" strokeWidth="4" />
    <circle cx="38" cy="46" r="14" stroke="#22D3EE" strokeWidth="2.5" strokeDasharray="8 5" />
    <circle cx="38" cy="46" r="4.5" fill="#F8FAFC" />
    <path d="M4 34H22M0 46H17M8 58H24" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />

    {/* Bold italic athletic wordmark */}
    <text
      x="76"
      y="48"
      fill="#F8FAFC"
      fontFamily="Chakra Petch, sans-serif"
      fontWeight="700"
      fontStyle="italic"
      fontSize="40"
      letterSpacing="2"
    >
      CYCLE
    </text>
    <text
      x="208"
      y="48"
      fill="#F59E0B"
      fontFamily="Chakra Petch, sans-serif"
      fontWeight="700"
      fontStyle="italic"
      fontSize="40"
      letterSpacing="2"
    >
      RUSH
    </text>
    <path d="M78 58H336" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M78 58H165" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const CoinIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" fill="#F59E0B" stroke="#78350F" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="6.5" fill="#FBBF24" stroke="#FEF08A" strokeWidth="1.2" />
    <path d="M12 7.5L13.5 11H16.5L14 13L15 16.5L12 14.5L9 16.5L10 13L7.5 11H10.5L12 7.5Z" fill="#FEF3C7" />
  </svg>
);

export const PowerUpIcon: React.FC<{
  type: PowerUpType;
  className?: string;
}> = ({ type, className = 'w-5 h-5' }) => {
  switch (type) {
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 2.5L20 5.8V11.8C20 16.6 16.6 20.5 12 22C7.4 20.5 4 16.6 4 11.8V5.8L12 2.5Z"
            fill="#0891B2"
            stroke="#A5F3FC"
            strokeWidth="1.7"
          />
          <path d="M12 6.5V17.5M7.5 11H16.5" stroke="#ECFEFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'speed_boost':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M13.5 2L5 13H11.5L10.5 22L19 11H12.5L13.5 2Z"
            fill="#F59E0B"
            stroke="#FEF3C7"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'magnet':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M6 5V12C6 15.3 8.7 18 12 18C15.3 18 18 15.3 18 12V5"
            stroke="#F43F5E"
            strokeWidth="4"
            strokeLinecap="butt"
          />
          <path d="M4 5H8M16 5H20" stroke="#E2E8F0" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'double_score':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <polygon
            points="12,2 20,9 12,22 4,9"
            fill="#10B981"
            stroke="#D1FAE5"
            strokeWidth="1.6"
          />
          <text
            x="12"
            y="14"
            textAnchor="middle"
            fill="#ECFDF5"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="8.5"
          >
            2X
          </text>
        </svg>
      );
    case 'super_jump':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 3L19 10H14.5V20H9.5V10H5L12 3Z"
            fill="#A855F7"
            stroke="#F3E8FF"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'slow_motion':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M6.5 3.5H17.5L13 11.5L17.5 20.5H6.5L11 11.5L6.5 3.5Z"
            fill="#3B82F6"
            stroke="#DBEAFE"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
