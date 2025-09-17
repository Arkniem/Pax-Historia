
import React from 'react';
import { Country } from '../types';

interface CountryStatsPanelProps {
  country: Country | null;
  onClose: () => void;
}

const formatNumber = (num: number, isGdp = true) => {
    if (isGdp) {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}T`;
        }
        return `${Math.round(num)}B`;
    }
    return `${num.toFixed(1)}M`;
};

const StatItem = ({ icon, label, value }: { icon: string; label: string; value: string | number }) => (
    <div className="flex items-center justify-between text-sm">
        <div className="flex items-center">
            <span className="mr-2 text-lg">{icon}</span>
            <span className="text-gray-400">{label}</span>
        </div>
        <span className="font-bold text-white">{value}</span>
    </div>
);

export default function CountryStatsPanel({ country, onClose }: CountryStatsPanelProps) {
  if (!country) {
    return null;
  }

  const stabilityColor = country.stability > 66 ? 'text-green-400' : country.stability > 33 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-2xl w-full max-w-xs z-30 animate-fade-in-right">
      <header className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center min-w-0">
            <div className="w-3 h-3 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: country.color }}></div>
            <h2 className="text-lg font-bold text-white truncate">{country.name}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none pl-2">&times;</button>
      </header>
      <div className="p-4 space-y-3">
        <StatItem icon="💰" label="GDP" value={`$${formatNumber(country.gdp)}`} />
        <StatItem icon="👥" label="Population" value={`${formatNumber(country.population, false)}`} />
        <StatItem icon="🛡️" label="Military Strength" value={Math.round(country.militaryStrength)} />
        <StatItem icon="🔬" label="Military Tech" value={country.militaryTech} />
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
                <span className="mr-2 text-lg">⚖️</span>
                <span className="text-gray-400">Stability</span>
            </div>
            <span className={`font-bold ${stabilityColor}`}>{Math.round(country.stability)}%</span>
        </div>
      </div>
       <style>{`
        @keyframes fade-in-right {
            from {
                opacity: 0;
                transform: translateX(20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        .animate-fade-in-right {
            animation: fade-in-right 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
