import React from 'react';
import { Country } from '../types';

interface HeaderProps {
  playerCountry: Country;
}

const formatNumber = (num: number) => {
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}T`;
    }
    return `${Math.round(num)}B`;
};

export default function Header({ playerCountry }: HeaderProps) {
  return (
    <header className="bg-gray-900 shadow-md p-4 flex justify-between items-center flex-shrink-0">
      <div className="flex items-center">
        <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: playerCountry.color }}></div>
        <h1 className="text-xl font-bold text-white">
          Playing as: <span className="text-primary">{playerCountry.name}</span>
        </h1>
      </div>
      <div className="flex items-center space-x-4 md:space-x-6 text-sm">
        <div className="flex items-center" title="Gross Domestic Product">
            <span className="text-gray-400 mr-2">💰</span>
            <span className="font-semibold">${formatNumber(playerCountry.gdp)}</span>
        </div>
        <div className="flex items-center" title="Population">
            <span className="text-gray-400 mr-2">👥</span>
            <span className="font-semibold">{playerCountry.population.toFixed(1)}M</span>
        </div>
        <div className="flex items-center" title="Stability">
            <span className="text-gray-400 mr-2">{playerCountry.stability > 66 ? '🟢' : playerCountry.stability > 33 ? '🟡' : '🔴'}</span>
            <span className="font-semibold">{Math.round(playerCountry.stability)}%</span>
        </div>
        <div className="flex items-center" title="Military Strength">
            <span className="text-gray-400 mr-2">🛡️</span>
            <span className="font-semibold">{Math.round(playerCountry.militaryStrength)}</span>
        </div>
      </div>
    </header>
  );
}