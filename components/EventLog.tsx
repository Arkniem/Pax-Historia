
import React from 'react';
import { WorldEvent } from '../types';

interface EventLogProps {
  events: WorldEvent[];
  onClose: () => void;
}

const eventIcons: { [key in WorldEvent['type']]: string } = {
    'ANNEXATION': '⚔️',
    'ALLIANCE': '🤝',
    'WAR': '💣',
    'PEACE': '🕊️',
    'TRADE_DEAL': '📈',
    'NARRATIVE': '🌍',
    'COUNTRY_FORMATION': '✨',
    'ECONOMIC_SHIFT': '💲',
    'CITY_RENAMED': '🏷️',
    'CITY_DESTROYED': '💥',
    'CITY_FOUNDED': '🏛️',
    'CHAT_INVITATION': '💬',
    'DEPLOY_UNIT': '🎖️',
    'MANUFACTURE_COMPLETE': '🏭',
    'SCRAP_UNIT': '♻️',
};

export default function EventLog({ events, onClose }: EventLogProps) {
  return (
    <div className="bg-gray-900 p-4 flex flex-col h-full overflow-y-hidden">
      <div className="flex items-center mb-3 flex-shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none mr-3">&times;</button>
        <h2 className="text-lg font-bold text-white">World Events</h2>
      </div>
      <div className="space-y-4 flex-1 overflow-y-auto pr-2">
        {events.map((event, index) => (
          <div key={index} className="flex items-start p-3 bg-gray-700 rounded-lg">
            <span className="text-xl mr-3">{eventIcons[event.type]}</span>
            <div className="flex-1">
                <p className="font-semibold text-sm text-gray-200">{event.date}</p>
                <p className="text-sm text-gray-300 mt-1">{event.description}</p>
                
                {event.type === 'COUNTRY_FORMATION' && event.newCountryName &&
                    <p className="text-xs text-gray-400 mt-1">
                        New Nation: {event.newCountryName}
                    </p>
                }

                {event.countries && event.countries.length > 0 && 
                    <p className="text-xs text-gray-400 mt-1">
                        Involving: {event.countries.join(', ')}
                    </p>
                }
                
                {event.territoryNames && event.territoryNames.length > 0 && 
                    <p className="text-xs text-gray-400 mt-1">
                        Territories: {event.territoryNames.join(', ')}
                    </p>
                }

                {event.type === 'CHAT_INVITATION' && event.chatInitiator &&
                    <p className="text-xs text-gray-400 mt-1">
                        Initiated by: {event.chatInitiator}
                    </p>
                }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
