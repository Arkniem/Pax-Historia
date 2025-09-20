import React, { useState, useRef, useEffect } from 'react';
import { GameState, DiplomaticChat, AdvisorSuggestion, WorldEvent } from '../types';

type DiplomacyView = 'lobby' | 'chat' | 'invitations';

interface DiplomacyModalProps {
  view: DiplomacyView;
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  activeChat: DiplomaticChat | null;
  pendingInvitations: WorldEvent[];
  onOpenChat: (chatId: string) => void;
  onStartNewChat: (participants: string[], topic: string) => void;
  onAcceptInvitation: (invitation: WorldEvent) => void;
  onDeclineInvitation: (invitation: WorldEvent) => void;
  onSendMessage: (chatId: string, message: string) => void;
  onDelegateTurn: (chatId: string) => void;
  onInterrupt: (chatId: string) => void;
  onAskAdvisorForChat: (chatId: string, message: string) => Promise<string>;
  isAdvising: boolean;
}

interface ChatLobbyProps {
    gameState: GameState;
    onOpenChat: (chatId: string) => void;
    onStartNewChat: (participants: string[], topic: string) => void;
    onClose: () => void;
}

const ChatLobby = ({ gameState, onOpenChat, onStartNewChat, onClose }: ChatLobbyProps) => {
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [topic, setTopic] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const playerCountryName = gameState.playerCountryName;
    const otherCountries = Object.keys(gameState.countries).filter(c => c !== playerCountryName).sort();

    const filteredCountries = searchTerm
        ? otherCountries.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
        : otherCountries;

    const handleToggleCountry = (countryName: string) => {
        setSelectedCountries(prev => 
            prev.includes(countryName) 
                ? prev.filter(c => c !== countryName) 
                : [...prev, countryName]
        );
    };

    const handleStart = () => {
        if (selectedCountries.length > 0 && topic.trim()) {
            onStartNewChat(selectedCountries, topic);
        }
    };
    
    return (
        <>
            <header className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Diplomatic Lobby</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
            </header>
            <div className="flex-1 p-4 overflow-y-auto">
                {/* Existing Chats */}
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Ongoing Conversations</h3>
                <div className="space-y-2">
                    {Object.values(gameState.chats).length > 0 ? Object.values(gameState.chats).map(chat => (
                        <div key={chat.id} onClick={() => onOpenChat(chat.id)} className="bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-600">
                            <p className="font-semibold text-white">{chat.topic}</p>
                            <p className="text-xs text-gray-400">{chat.participants.join(', ')}</p>
                        </div>
                    )) : <p className="text-sm text-gray-500">No active conversations.</p>}
                </div>

                {/* New Chat */}
                <div className="mt-6 pt-4 border-t border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Start a New Conversation</h3>
                    <div className="space-y-3">
                        <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic of discussion..." className="w-full bg-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary" />
                        <div>
                            <p className="text-sm text-gray-400 mb-2">Select participants:</p>
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                placeholder="Search for a country..." 
                                className="w-full bg-gray-900 rounded px-3 py-2 mb-2 text-white focus:outline-none focus:ring-1 focus:ring-primary" 
                            />
                            <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded">
                                {filteredCountries.map(name => (
                                    <label key={name} className="flex items-center space-x-2 p-1 cursor-pointer hover:bg-gray-700 rounded">
                                        <input type="checkbox" checked={selectedCountries.includes(name)} onChange={() => handleToggleCountry(name)} className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 text-primary focus:ring-primary"/>
                                        <span>{name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleStart} disabled={selectedCountries.length === 0 || !topic.trim()} className="w-full bg-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition">
                            Start Chat
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

interface ChatViewProps {
    gameState: GameState;
    chat: DiplomaticChat;
    onClose: () => void;
    onSendMessage: (chatId: string, message: string) => void;
    onDelegateTurn: (chatId: string) => void;
    onInterrupt: (chatId: string) => void;
    onAskAdvisorForChat: (chatId: string, message: string) => Promise<string>;
    isAdvising: boolean;
}

const ChatView = ({ gameState, chat, onClose, onSendMessage, onDelegateTurn, onInterrupt, onAskAdvisorForChat, isAdvising }: ChatViewProps) => {
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const playerCountryName = gameState.playerCountryName;
    const isPlayersTurn = chat.currentSpeaker === playerCountryName;
    const isAiThinking = chat.currentSpeaker === null;
    const isGroupChat = chat.participants.length > 2;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat.messages, isAiThinking]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && isPlayersTurn) {
          onSendMessage(chat.id, message);
          setMessage('');
        }
    };
    
    const handleAdviseClick = async () => {
        if (!message.trim() || isAdvising) return;
        const suggestion = await onAskAdvisorForChat(chat.id, message);
        setMessage(suggestion);
    };

    return (
        <>
            <header className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white truncate pr-4" title={chat.topic}>{chat.topic}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">Participants: {chat.participants.join(', ')}</p>
            </header>
            <div className="flex-1 p-4 overflow-y-auto">
                {chat.messages.map((msg, index) => (
                    <div key={index} className={`flex mb-4 ${msg.sender === playerCountryName ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-md">
                            <p className={`text-xs mb-1 ${msg.sender === playerCountryName ? 'text-right' : 'text-left'} text-gray-400`}>{msg.sender}</p>
                            <div className={`rounded-lg px-4 py-2 ${msg.sender === playerCountryName ? 'bg-primary text-white' : 'bg-gray-700 text-gray-200'}`}>
                                {msg.text}
                            </div>
                        </div>
                    </div>
                ))}
                {isAiThinking && (
                    <div className="flex justify-start mb-4">
                        <div className="bg-gray-700 text-gray-200 rounded-lg px-4 py-2 max-w-sm flex items-center">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse mr-2"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse mr-2 delay-150"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <footer className="p-4 border-t border-gray-700">
                {isPlayersTurn ? (
                    <form onSubmit={handleSubmit} className="flex space-x-2">
                         <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your response..." className="flex-1 bg-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                         <button type="button" onClick={handleAdviseClick} disabled={!message.trim() || isAdvising} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg transition">{isAdvising ? '...' : 'Advise'}</button>
                         {isGroupChat && <button type="button" onClick={() => onDelegateTurn(chat.id)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded-lg transition">Delegate</button>}
                         <button type="submit" disabled={!message.trim()} className="bg-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition">Send</button>
                    </form>
                ) : (
                    <div className="text-center">
                        <p className="text-sm text-gray-400 mb-2">{isAiThinking ? 'Waiting for response...' : `Waiting for ${chat.currentSpeaker}`}</p>
                        {isGroupChat && 
                            <button onClick={() => onInterrupt(chat.id)} disabled={isAiThinking} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition">
                                Interrupt
                            </button>
                        }
                    </div>
                )}
            </footer>
        </>
    );
};

interface InvitationViewProps {
    invitations: WorldEvent[];
    onAccept: (invitation: WorldEvent) => void;
    onDecline: (invitation: WorldEvent) => void;
    onClose: () => void;
}

const InvitationView = ({ invitations, onAccept, onDecline, onClose }: InvitationViewProps) => {
    const invitation = invitations[0]; // Show one at a time
    if (!invitation) return null;

    return (
        <>
             <header className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Diplomatic Invitation</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
            </header>
            <div className="p-6">
                <p className="text-gray-300 mb-2">You have received an invitation from <span className="font-semibold text-white">{invitation.chatInitiator}</span>.</p>
                <p className="text-gray-400 text-sm mb-4">Topic: "{invitation.description}"</p>
                <div className="mb-4">
                    <h4 className="font-semibold text-gray-200 mb-2">Invited Parties:</h4>
                    <ul className="list-disc list-inside text-gray-400">
                        {invitation.chatParticipants?.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={() => onDecline(invitation)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition">Decline</button>
                    <button onClick={() => onAccept(invitation)} className="bg-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition">Accept</button>
                </div>
            </div>
        </>
    );
};


export default function DiplomacyModal({ view, isOpen, onClose, gameState, activeChat, pendingInvitations, ...handlers }: DiplomacyModalProps) {
    if (!isOpen) return null;

    const renderView = () => {
        switch (view) {
            case 'invitations':
                return <InvitationView invitations={pendingInvitations} onAccept={handlers.onAcceptInvitation} onDecline={handlers.onDeclineInvitation} onClose={onClose} />;
            case 'lobby':
                return <ChatLobby gameState={gameState} onOpenChat={handlers.onOpenChat} onStartNewChat={handlers.onStartNewChat} onClose={onClose} />;
            case 'chat':
                if (activeChat) {
                    return <ChatView gameState={gameState} chat={activeChat} onClose={onClose} {...handlers} />;
                }
                return <p>Error: No active chat selected.</p>;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col h-[80vh]">
                {renderView()}
            </div>
        </div>
    );
}