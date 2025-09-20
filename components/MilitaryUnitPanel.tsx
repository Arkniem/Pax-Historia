import React, { useState } from 'react';
import { MilitaryUnit } from '../types';

interface MilitaryUnitPanelProps {
  unit: MilitaryUnit | null;
  onClose: () => void;
  playerCountryName: string | null;
  onUnitOrder: (unitId: string, order: string) => Promise<void>;
}

const StatItem = ({ icon, label, value }: { icon: string; label: string; value: string | number }) => (
    <div className="flex items-center justify-between text-sm">
        <div className="flex items-center">
            <span className="mr-2 text-lg">{icon}</span>
            <span className="text-gray-400">{label}</span>
        </div>
        <span className="font-bold text-white text-right">{value}</span>
    </div>
);

export default function MilitaryUnitPanel({ unit, onClose, playerCountryName, onUnitOrder }: MilitaryUnitPanelProps) {
  const [order, setOrder] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);

  if (!unit) {
    return null;
  }

  const handleSendOrder = async () => {
    if (!order.trim() || isOrdering) return;
    setIsOrdering(true);
    await onUnitOrder(unit.id, order);
    setOrder('');
    setIsOrdering(false);
  };
  
  const isPlayerOwner = unit.owner === playerCountryName;

  return (
    <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-80 backdrop-blur-sm rounded-lg shadow-2xl w-full max-w-xs z-30 animate-fade-in-right flex flex-col max-h-[95vh]">
      <header className="p-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center min-w-0">
            <h2 className="text-lg font-bold text-white truncate" title={unit.name}>{unit.name}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none pl-2">&times;</button>
      </header>
      <div className="p-4 space-y-3 overflow-y-auto">
        <StatItem icon="🌍" label="Owner" value={unit.owner} />
        <StatItem icon="🎖️" label="Commander" value={`${unit.leader.rank} ${unit.leader.name}`} />
        <StatItem icon="💥" label="Strength" value={unit.strength} />
        
        <div className="pt-2 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Composition</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                {unit.composition.map((comp, index) => (
                    <div key={index} className="text-xs p-2 bg-gray-800 rounded">
                        <p className="font-bold text-gray-200">{comp.name}</p>
                        <p className="text-gray-400 mt-1">{comp.equipment.join(', ')}</p>
                    </div>
                ))}
            </div>
        </div>

        <div className="pt-2 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Communications</h3>
            {isPlayerOwner ? (
                <div className="space-y-2">
                    <textarea
                      value={order}
                      onChange={(e) => setOrder(e.target.value)}
                      className="w-full h-20 p-2 bg-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                      placeholder="Issue new orders..."
                      disabled={isOrdering}
                    />
                    <button
                      onClick={handleSendOrder}
                      disabled={!order.trim() || isOrdering}
                      className="w-full bg-primary hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-wait text-white font-bold py-2 px-4 rounded-lg transition text-sm"
                    >
                      {isOrdering ? 'Transmitting...' : 'Send Orders'}
                    </button>
                </div>
            ) : (
                <p className="text-xs text-gray-500 italic">No access to this unit's command channel.</p>
            )}
        </div>
         <div className="pt-2 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Orders Log</h3>
             <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                <div className="text-xs p-2 bg-gray-800 rounded">
                    <p className="font-bold text-gray-200">Current Order:</p>
                    <p className="text-gray-400 mt-1">{unit.currentOrder}</p>
                </div>
                {unit.ordersLog.map((log, index) => (
                    <div key={index} className="text-xs p-2 bg-gray-800 rounded opacity-80">
                        <p className="font-bold text-gray-300">Year {log.year}: {log.order}</p>
                        <p className="text-gray-400 mt-1"><span className="font-semibold text-gray-300">Outcome:</span> {log.outcome}</p>
                    </div>
                ))}
            </div>
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