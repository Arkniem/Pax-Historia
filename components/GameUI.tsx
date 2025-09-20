import React, { useState, useEffect, useRef } from 'react';
import { GameState, WorldEvent, Country, MapData, DiplomaticChat, UnitType, MilitaryUnit, Toast } from '../types';
import WorldMap from './WorldMap';
import EventLog from './EventLog';
import DiplomacyModal from './DiplomacyModal';
import Header from './Header';
import CountryStatsPanel from './CountryStatsPanel';
import DeploymentModal from './DeploymentModal';
import MilitaryUnitPanel from './MilitaryUnitPanel';
import { getGeneralAdvice, getAdvisorResponse, simulateWorldEvents } from '../services/geminiService';

interface GameUIProps {
  gameState: GameState;
  mapData: MapData;
  toasts: Toast[];
  onNewEvents: (events: WorldEvent[]) => Promise<void>;
  pendingInvitations: WorldEvent[];
  onCreateChat: (participants: string[], topic: string) => string;
  onAcceptInvitation: (invitation: WorldEvent) => string;
  onDeclineInvitation: (invitation: WorldEvent) => void;
  onSendMessage: (chatId: string, message: string) => void;
  onDelegateTurn: (chatId: string) => void;
  onInterrupt: (chatId: string) => void;
  onLoadGame: (loadedGameState: GameState) => void;
  onDeployUnit: (locationDescription: string, deploymentBrief: string) => Promise<void>;
  onUnitOrder: (unitId: string, order: string) => Promise<void>;
}

type DiplomacyView = 'closed' | 'lobby' | 'chat' | 'invitations';

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
                <header className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
                </header>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

const ActionPanel = ({ onSimulate, isSimulating }: { onSimulate: (action: string) => void, isSimulating: boolean }) => {
  const [action, setAction] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action.trim() && !isSimulating) {
      onSimulate(action);
      setAction('');
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      <textarea
        className="w-full h-24 p-2 bg-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        placeholder="e.g., Invest in new technologies, seek an alliance with France..."
        value={action}
        onChange={(e) => setAction(e.target.value)}
        disabled={isSimulating}
      />
      <button
        type="submit"
        disabled={isSimulating || !action.trim()}
        className="w-full mt-3 bg-primary hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-wait text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out flex items-center justify-center"
      >
        {isSimulating ? 'Simulating...' : 'Submit Action'}
      </button>
    </form>
  );
};

const AdvisorPanel = ({ onAskAdvice, isAdvising, advice }: { onAskAdvice: (question: string) => void, isAdvising: boolean, advice: string | null }) => {
    const [question, setQuestion] = useState('What should be our nation\'s primary focus right now?');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (question.trim() && !isAdvising) {
            onAskAdvice(question);
        }
    };
    return (
        <div>
            <form onSubmit={handleSubmit}>
                <textarea
                  className="w-full h-20 p-2 bg-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Ask your advisor for strategic guidance..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isAdvising}
                />
                <button
                    type="submit"
                    disabled={isAdvising || !question.trim()}
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-wait text-white font-bold py-2 px-4 rounded-lg transition"
                >
                    {isAdvising ? 'Thinking...' : 'Ask for Advice'}
                </button>
            </form>
            {advice && (
                <div className="mt-4 p-3 bg-gray-700 rounded-lg max-h-48 overflow-y-auto">
                    <h3 className="font-semibold text-indigo-300">Advisor's Counsel:</h3>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{advice}</p>
                </div>
            )}
        </div>
    );
};

const ToastContainer = ({ toasts }: { toasts: Toast[] }) => {
    return (
        <div className="fixed top-5 right-5 z-[100] w-full max-w-xs space-y-3">
            {toasts.map(toast => (
                <div key={toast.id} className={`flex items-center justify-between p-4 rounded-lg shadow-lg text-white animate-fade-in-right ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    <span>{toast.message}</span>
                </div>
            ))}
        </div>
    )
};


export default function GameUI({ 
  gameState, 
  mapData,
  toasts, 
  onNewEvents,
  pendingInvitations,
  onCreateChat,
  onAcceptInvitation,
  onDeclineInvitation,
  onSendMessage,
  onDelegateTurn,
  onInterrupt,
  onLoadGame,
  onDeployUnit,
  onUnitOrder,
}: GameUIProps) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [diplomacyView, setDiplomacyView] = useState<DiplomacyView>('closed');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isAdvisorModalOpen, setIsAdvisorModalOpen] = useState(false);
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
  const [isEventsPanelOpen, setIsEventsPanelOpen] = useState(false);
  const [selectedCountryForStats, setSelectedCountryForStats] = useState<Country | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  
  const [isAdvising, setIsAdvising] = useState(false);
  const [generalAdvice, setGeneralAdvice] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gameMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pendingInvitations.length > 0 && !isSimulating && diplomacyView === 'closed') {
        setDiplomacyView('invitations');
    }
  }, [pendingInvitations, isSimulating, diplomacyView]);

  // Close game menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (gameMenuRef.current && !gameMenuRef.current.contains(event.target as Node)) {
            setIsGameMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSimulate = async (action: string) => {
    setIsSimulating(true);
    setIsActionModalOpen(false); // Close modal on submit
    setDiplomacyView('closed');
    const chatSummary = Object.values(gameState.chats).map(chat => 
        `Topic: ${chat.topic}\nParticipants: ${chat.participants.join(', ')}\n` +
        chat.messages.slice(-5).map(m => `${m.sender}: ${m.text}`).join('\n')
    ).join('\n\n');

    try {
      const events = await simulateWorldEvents(gameState, action, chatSummary);
      await onNewEvents(events);
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setIsSimulating(false);
    }
  };
  
  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    setDiplomacyView('chat');
  };

  const handleStartNewChat = (participants: string[], topic: string) => {
    const newChatId = onCreateChat(participants, topic);
    setActiveChatId(newChatId);
    setDiplomacyView('chat');
  };

  const handleCloseDiplomacy = () => {
    setDiplomacyView('closed');
    setActiveChatId(null);
  };

  const handleAskGeneralAdvice = async (question: string) => {
      setIsAdvising(true);
      setGeneralAdvice(null);
      try {
          const advice = await getGeneralAdvice(gameState, question);
          setGeneralAdvice(advice);
      } catch (error) {
          console.error("Error getting general advice:", error);
      } finally {
          setIsAdvising(false);
      }
  };
  
  const handleAskAdvisorForChat = async (chatId: string, message: string): Promise<string> => {
    setIsAdvising(true);
    const chat = gameState.chats[chatId];
    if (!chat) {
        setIsAdvising(false);
        return message; // Return original message if chat not found
    }
    try {
        const { suggestion } = await getAdvisorResponse(gameState, chat, message);
        return suggestion;
    } catch (error) {
        console.error("Error getting advisor suggestion:", error);
        return message; // Return original on error
    } finally {
        setIsAdvising(false);
    }
  };

  const handleAcceptAndOpenChat = (invitation: WorldEvent) => {
    const newChatId = onAcceptInvitation(invitation);
    if (newChatId) {
        setActiveChatId(newChatId);
        setDiplomacyView('chat');
    }
  };

  const handleDeclineAndClose = (invitation: WorldEvent) => {
    onDeclineInvitation(invitation);
    // If this was the last invitation, close the diplomacy view.
    if (pendingInvitations.length <= 1) {
        setDiplomacyView('closed');
    }
  };

  const handleTerritoryStatSelect = (territoryId: string) => {
    setSelectedUnitId(null); // Deselect any unit when a territory is clicked
    const territory = gameState.territories[territoryId];
    if (territory && territory.owner !== 'Unclaimed') {
        const ownerCountry = gameState.countries[territory.owner];
        if (ownerCountry && selectedCountryForStats?.name === ownerCountry.name) {
            setSelectedCountryForStats(null);
        } else if (ownerCountry) {
            setSelectedCountryForStats(ownerCountry);
        }
    } else {
        setSelectedCountryForStats(null);
    }
  };

  const handleUnitSelect = (unitId: string) => {
    setSelectedCountryForStats(null); // Deselect any country when a unit is clicked
    if (selectedUnitId === unitId) {
        setSelectedUnitId(null);
    } else {
        setSelectedUnitId(unitId);
    }
  };
  
  const handleDeploy = async (locationDescription: string, deploymentBrief: string) => {
    setIsDeploymentModalOpen(false);
    setIsSimulating(true); // Use isSimulating to show a loading state
    await onDeployUnit(locationDescription, deploymentBrief);
    setIsSimulating(false);
  };

  const handleSaveGame = () => {
    if (!gameState) return;
    const saveData = JSON.stringify(gameState, null, 2); // Pretty print JSON
    const blob = new Blob([saveData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-sim-save-${gameState.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("Failed to read file");
        const loadedState = JSON.parse(text);
        onLoadGame(loadedState);
      } catch (error) {
        console.error("Failed to load game:", error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const playerCountry = gameState.countries[gameState.playerCountryName!];
  const activeChat = activeChatId ? gameState.chats[activeChatId] : null;
  const selectedUnit = selectedUnitId ? gameState.militaryUnits[selectedUnitId] : null;

  return (
    <div className="flex flex-col h-screen bg-gray-800">
      <Header playerCountry={playerCountry} />
      <ToastContainer toasts={toasts} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          <WorldMap
            territories={gameState.territories}
            countries={gameState.countries}
            cities={gameState.cities}
            militaryUnits={gameState.militaryUnits}
            selectedUnit={selectedUnit}
            mapData={mapData}
            onTerritoryClick={handleTerritoryStatSelect}
            onUnitClick={handleUnitSelect}
            playerCountryName={gameState.playerCountryName!}
          />
          <CountryStatsPanel 
            country={selectedCountryForStats} 
            onClose={() => setSelectedCountryForStats(null)} 
          />
          <MilitaryUnitPanel 
            unit={selectedUnit}
            onClose={() => setSelectedUnitId(null)}
            onUnitOrder={onUnitOrder}
            playerCountryName={gameState.playerCountryName}
          />
          <div className="absolute bottom-4 left-4 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 z-20">
              <button 
                  onClick={() => setIsActionModalOpen(true)}
                  className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                  title="National Action"
              >
                  ⚡
              </button>
              <button 
                  onClick={() => setIsAdvisorModalOpen(true)}
                  className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                  title="Strategic Advisor"
              >
                  💡
              </button>
              <button 
                  onClick={() => setDiplomacyView(pendingInvitations.length > 0 ? 'invitations' : 'lobby')}
                  className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition relative"
                  title="Diplomacy"
              >
                  🤝
                  {pendingInvitations.length > 0 && <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 ring-2 ring-gray-900"></span>}
              </button>
               <button 
                  onClick={() => setIsDeploymentModalOpen(true)}
                  className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                  title="Deploy Unit"
              >
                  🎖️
              </button>
              <button 
                  onClick={() => setIsEventsPanelOpen(true)}
                  className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                  title="World Events"
              >
                  🌍
              </button>
              <div className="hidden md:block border-l-2 border-gray-700 mx-1"></div>
               <div ref={gameMenuRef} className="relative flex items-center">
                  <button 
                      onClick={() => setIsGameMenuOpen(prev => !prev)}
                      className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                      title="Game Options"
                  >
                      ⚙️
                  </button>
                  {isGameMenuOpen && (
                      <div className="absolute bottom-0 left-full ml-2 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 animate-fade-in-menu">
                           <button 
                              onClick={handleSaveGame}
                              className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                              title="Save Game"
                          >
                              💾
                          </button>
                          <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                              title="Load Game"
                          >
                              📂
                          </button>
                      </div>
                  )}
              </div>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
          </div>
        </main>
      </div>

      <div className={`fixed top-0 right-0 h-full w-full md:w-1/3 lg:w-1/4 bg-gray-900 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isEventsPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <EventLog events={gameState.events} onClose={() => setIsEventsPanelOpen(false)} />
      </div>

      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title="National Action">
          <ActionPanel onSimulate={handleSimulate} isSimulating={isSimulating} />
      </Modal>

      <Modal isOpen={isAdvisorModalOpen} onClose={() => setIsAdvisorModalOpen(false)} title="Strategic Advisor">
          <AdvisorPanel onAskAdvice={handleAskGeneralAdvice} isAdvising={isAdvising} advice={generalAdvice} />
      </Modal>
      
      <DeploymentModal 
        isOpen={isDeploymentModalOpen}
        onClose={() => setIsDeploymentModalOpen(false)}
        onDeploy={handleDeploy}
        gameState={gameState}
        isDeploying={isSimulating}
      />

      {(diplomacyView !== 'closed') && (
        <DiplomacyModal
          view={diplomacyView}
          isOpen={true}
          onClose={handleCloseDiplomacy}
          gameState={gameState}
          activeChat={activeChat}
          pendingInvitations={pendingInvitations}
          onOpenChat={handleOpenChat}
          onStartNewChat={handleStartNewChat}
          onAcceptInvitation={handleAcceptAndOpenChat}
          onDeclineInvitation={handleDeclineAndClose}
          onSendMessage={onSendMessage}
          onDelegateTurn={onDelegateTurn}
          onInterrupt={onInterrupt}
          onAskAdvisorForChat={handleAskAdvisorForChat}
          isAdvising={isAdvising}
        />
      )}
      <style>{`
        @keyframes fade-in-menu {
            from { opacity: 0; transform: scale(0.95) translateX(-10px); }
            to { opacity: 1; transform: scale(1) translateX(0); }
        }
        .animate-fade-in-menu {
            animation: fade-in-menu 0.2s ease-out forwards;
        }
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