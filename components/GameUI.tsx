
import React, { useState, useEffect } from 'react';
import { GameState, WorldEvent, Country, AdvisorSuggestion, MapData, DiplomaticChat } from '../types';
import WorldMap from './WorldMap';
import EventLog from './EventLog';
import DiplomacyModal from './DiplomacyModal';
import Header from './Header';
import CountryStatsPanel from './CountryStatsPanel';
import { simulateWorldEvents, getGeneralAdvice } from '../services/geminiService';

interface GameUIProps {
  gameState: GameState;
  mapData: MapData;
  onNewEvents: (events: WorldEvent[]) => void;
  pendingInvitations: WorldEvent[];
  onCreateChat: (participants: string[], topic: string) => string;
  onAcceptInvitation: (invitation: WorldEvent) => string;
  onDeclineInvitation: (invitation: WorldEvent) => void;
  onSendMessage: (chatId: string, message: string) => void;
  onDelegateTurn: (chatId: string) => void;
  onInterrupt: (chatId: string) => void;
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
                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                    <h3 className="font-semibold text-indigo-300">Advisor's Counsel:</h3>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{advice}</p>
                </div>
            )}
        </div>
    );
};

export default function GameUI({ 
  gameState, 
  mapData, 
  onNewEvents,
  pendingInvitations,
  onCreateChat,
  onAcceptInvitation,
  onDeclineInvitation,
  onSendMessage,
  onDelegateTurn,
  onInterrupt,
}: GameUIProps) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [diplomacyView, setDiplomacyView] = useState<DiplomacyView>('closed');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isAdvisorModalOpen, setIsAdvisorModalOpen] = useState(false);
  const [isEventsPanelOpen, setIsEventsPanelOpen] = useState(false);
  const [selectedCountryForStats, setSelectedCountryForStats] = useState<Country | null>(null);
  
  const [isAdvising, setIsAdvising] = useState(false);
  const [advisorSuggestion, setAdvisorSuggestion] = useState<AdvisorSuggestion | null>(null);
  const [generalAdvice, setGeneralAdvice] = useState<string | null>(null);

  useEffect(() => {
    if (pendingInvitations.length > 0 && !isSimulating) {
        setDiplomacyView('invitations');
    }
  }, [pendingInvitations, isSimulating]);

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
      onNewEvents(events);
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

  const handleAcceptAndOpenChat = (invitation: WorldEvent) => {
    const newChatId = onAcceptInvitation(invitation);
    if (newChatId) {
        setActiveChatId(newChatId);
        setDiplomacyView('chat');
    }
  };

  const handleTerritoryStatSelect = (territoryId: string) => {
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

  const playerCountry = gameState.countries[gameState.playerCountryName!];
  const activeChat = activeChatId ? gameState.chats[activeChatId] : null;

  return (
    <div className="flex flex-col h-screen bg-gray-800">
      <Header playerCountry={playerCountry} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          <WorldMap
            territories={gameState.territories}
            countries={gameState.countries}
            cities={gameState.cities}
            mapData={mapData}
            onTerritoryClick={handleTerritoryStatSelect}
            playerCountryName={gameState.playerCountryName!}
          />
          <CountryStatsPanel 
            country={selectedCountryForStats} 
            onClose={() => setSelectedCountryForStats(null)} 
          />
          <div className="absolute bottom-4 left-4 flex space-x-2 z-20">
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
                  onClick={() => setDiplomacyView('lobby')}
                  className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                  title="Diplomacy"
              >
                  🤝
              </button>
              <button 
                  onClick={() => setIsEventsPanelOpen(true)}
                  className="bg-gray-900 text-2xl text-white font-bold p-3 rounded-full shadow-lg hover:bg-gray-700 transition"
                  title="World Events"
              >
                  🌍
              </button>
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
          onDeclineInvitation={onDeclineInvitation}
          onSendMessage={onSendMessage}
          onDelegateTurn={onDelegateTurn}
          onInterrupt={onInterrupt}
          onAskAdvisor={() => { /* Placeholder, advisor logic is complex */ }}
          isAdvising={isAdvising}
          advisorSuggestion={advisorSuggestion}
          onClearAdvisorSuggestion={() => setAdvisorSuggestion(null)}
        />
      )}
    </div>
  );
}
