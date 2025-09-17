import React, { useState, useEffect, useRef } from 'react';
import { GameState, WorldEvent, GamePhase, MapData, Country, City, DiplomaticChat, ChatMessage } from './types';
import CountrySelectionScreen from './components/CountrySelectionScreen';
import GameUI from './components/GameUI';
import { generateInitialGameState, stringToColor } from './services/stateService';
import { getGroupChatTurn } from './services/geminiService';

const atlasURLs: { [key: string]: string } = {
  world: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
  us: 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json',
};


export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.LOADING);
  const [error, setError] = useState<string | null>(null);
  
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const initializeGame = async () => {
      try {
        const responses = await Promise.all(
            Object.values(atlasURLs).map(url => fetch(url))
        );

        for (const response of responses) {
            if (!response.ok) {
                throw new Error(`Failed to fetch map data from ${response.url}: ${response.status} ${response.statusText}`);
            }
        }
        
        const jsonData = await Promise.all(responses.map(res => res.json()));
        
        const loadedMapData: MapData = Object.keys(atlasURLs).reduce((acc, key, index) => {
            acc[key] = jsonData[index];
            return acc;
        }, {} as MapData);

        setMapData(loadedMapData);
        const initialState = generateInitialGameState(loadedMapData);
        setGameState(initialState);
        setGamePhase(GamePhase.SELECTION);
      } catch (e: any) {
        console.error("Initialization failed:", e);
        setError(`Failed to load critical map data. Please check your internet connection and refresh the page. Details: ${e.message}`);
        setGamePhase(GamePhase.LOADING);
      }
    };

    initializeGame();
  }, []);

  const handleCountrySelect = (selectionName: string) => {
    if (!gameState) return;

    // Standard country selection
    if (gameState.countries[selectionName]) {
        setGameState(prevState => ({
          ...prevState!,
          playerCountryName: selectionName,
        }));
        setGamePhase(GamePhase.PLAYING);
        return;
    }

    // A territory is seceding to become a new country (e.g., a US State)
    setGameState(prevState => {
        if (!prevState) return null;

        const territory = Object.values(prevState.territories).find(t => t.name === selectionName);
        if (!territory) return prevState;

        const parentCountry = prevState.countries[territory.parentCountryName];
        if (!parentCountry) return prevState;

        let hash = 0;
        for (let i = 0; i < selectionName.length; i++) { 
            hash = selectionName.charCodeAt(i) + ((hash << 5) - hash); 
        }
        hash = Math.abs(hash);

        const newCountry: Country = {
            name: selectionName,
            color: stringToColor(selectionName + " secession"), // Salt to get a different color
            gdp: Math.max(1, Math.floor(parentCountry.gdp * (0.05 + (hash % 10) / 100))),
            population: Math.max(0.1, parseFloat((parentCountry.population * (0.05 + (hash % 10) / 100)).toFixed(1))),
            stability: 30 + (hash % 25), // Secession is an unstable act
            resources: [],
            militaryStrength: Math.max(1, Math.floor(parentCountry.militaryStrength * (0.02 + (hash % 8) / 100))),
            militaryTech: Math.max(1, parentCountry.militaryTech - (hash % 2)),
        };

        const newCountries = { ...prevState.countries, [selectionName]: newCountry };
        const newTerritories = { ...prevState.territories };
        newTerritories[territory.id] = { ...territory, owner: selectionName };
        
        return {
            ...prevState,
            countries: newCountries,
            territories: newTerritories,
            playerCountryName: selectionName,
        };
    });
    setGamePhase(GamePhase.PLAYING);
  };
  
  const handleNewEvents = (events: WorldEvent[]) => {
    setGameState(prevState => {
        if (!prevState) return null;
        
        let newTerritories = { ...prevState.territories };
        let newCountries = { ...prevState.countries };
        let newCities = [...prevState.cities];
        const chatInvitations = events.filter(e => e.type === 'CHAT_INVITATION');

        events.forEach(event => {
            if (event.type === 'ANNEXATION' && event.countries.length === 2) {
                const [aggressorName, targetCountryName] = event.countries;
                
                if (event.territoryNames && event.territoryNames.length > 0) {
                    event.territoryNames.forEach(name => {
                        const territoryToUpdate = Object.values(newTerritories).find(t => t.name === name);
                        if (territoryToUpdate) {
                            newTerritories[territoryToUpdate.id] = { ...territoryToUpdate, owner: aggressorName };
                        }
                    });
                } else {
                    const territoriesToUpdate = Object.values(newTerritories).filter(t => t.owner === targetCountryName);
                    territoriesToUpdate.forEach(t => {
                        newTerritories[t.id] = { ...t, owner: aggressorName };
                    });
                }
            } else if (event.type === 'COUNTRY_FORMATION' && event.newCountryName && event.territoryNames) {
                const { newCountryName, territoryNames } = event;

                if (!newCountries[newCountryName]) {
                    let hash = 0;
                    for (let i = 0; i < newCountryName.length; i++) { hash = newCountryName.charCodeAt(i) + ((hash << 5) - hash); }
                    
                    newCountries[newCountryName] = { 
                        name: newCountryName, 
                        color: stringToColor(newCountryName),
                        gdp: 5 + (Math.abs(hash) % 45),
                        population: 1 + (Math.abs(hash) % 10),
                        stability: 40 + (Math.abs(hash) % 20),
                        resources: [],
                        militaryStrength: 5 + (Math.abs(hash) % 15),
                        militaryTech: 1 + (Math.abs(hash) % 4),
                    };
                }

                territoryNames.forEach(name => {
                    const territoryToUpdate = Object.values(newTerritories).find(t => t.name === name);
                    if (territoryToUpdate) {
                        newTerritories[territoryToUpdate.id] = { ...territoryToUpdate, owner: newCountryName };
                    }
                });
            }

            if (event.economicEffects) {
                event.economicEffects.forEach(effect => {
                    const countryToUpdate = newCountries[effect.country];
                    if (countryToUpdate) {
                        const updatedCountry = { ...countryToUpdate };
                        if (typeof effect.gdpChange === 'number') updatedCountry.gdp = Math.max(1, updatedCountry.gdp + effect.gdpChange);
                        if (typeof effect.populationChange === 'number') updatedCountry.population = Math.max(0.1, updatedCountry.population + effect.populationChange);
                        if (typeof effect.stabilityChange === 'number') updatedCountry.stability = Math.max(0, Math.min(100, updatedCountry.stability + effect.stabilityChange));
                        if (typeof effect.militaryStrengthChange === 'number') updatedCountry.militaryStrength = Math.max(0, updatedCountry.militaryStrength + effect.militaryStrengthChange);
                        if (effect.newResources) updatedCountry.resources = [...new Set([...updatedCountry.resources, ...effect.newResources])];
                        newCountries[effect.country] = updatedCountry;
                    }
                });
            }

            if (event.type === 'CITY_FOUNDED' && event.newCityName && event.territoryForNewCity && event.newCityCoordinates) {
                const territoryExists = Object.values(newTerritories).find(t => t.name === event.territoryForNewCity);
                if(territoryExists) {
                    newCities.push({ id: `${event.newCityName}-${Date.now()}`, name: event.newCityName, coordinates: event.newCityCoordinates, territoryId: territoryExists.id, isCapital: false });
                }
            } else if (event.type === 'CITY_RENAMED' && event.cityName && event.newCityName) {
                newCities = newCities.map(city => city.name === event.cityName ? { ...city, name: event.newCityName, id: `${event.newCityName}-${city.territoryId}` } : city);
            } else if (event.type === 'CITY_DESTROYED' && event.cityName) {
                newCities = newCities.filter(city => city.name !== event.cityName);
            }
        });
        
        const correctlyOrderedNewEvents = [...events].reverse();
        const combinedEvents = [...correctlyOrderedNewEvents, ...prevState.events];
        const newPendingInvitations = [...prevState.pendingInvitations, ...chatInvitations];

        return {
            ...prevState,
            territories: newTerritories,
            countries: newCountries,
            cities: newCities,
            events: combinedEvents,
            year: prevState.year + 1,
            pendingInvitations: newPendingInvitations,
        };
    });
  };

  const updateChat = (chatId: string, update: Partial<DiplomaticChat> | ((chat: DiplomaticChat) => Partial<DiplomaticChat>)) => {
    setGameState(prev => {
      if (!prev) return null;
      const currentChat = prev.chats[chatId];
      if (!currentChat) return prev;
      const newPartial = typeof update === 'function' ? update(currentChat) : update;
      return { ...prev, chats: { ...prev.chats, [chatId]: { ...currentChat, ...newPartial } } };
    });
  };
  
  const handleCreateChat = (participants: string[], topic: string) => {
    if (!gameState || !gameState.playerCountryName) return '';
    const chatId = `chat_${Date.now()}`;
    const newChat: DiplomaticChat = {
      id: chatId,
      participants: [gameState.playerCountryName, ...participants],
      messages: [],
      topic,
      currentSpeaker: gameState.playerCountryName,
    };
    setGameState(prev => ({ ...prev!, chats: { ...prev!.chats, [chatId]: newChat } }));
    return chatId;
  };

  const advanceChatTurn = async (chatId: string, isDelegation: boolean = false) => {
    const currentGameState = gameStateRef.current;
    if (!currentGameState || !currentGameState.playerCountryName) return;
    const chat = currentGameState.chats[chatId];
    if (!chat) return;

    updateChat(chatId, { currentSpeaker: null });

    try {
        const { nextSpeaker, message } = await getGroupChatTurn(currentGameState, chat, isDelegation);
        const newMessages: ChatMessage[] = message ? [{ sender: nextSpeaker, text: message }] : [];
        
        updateChat(chatId, current => ({
            messages: message ? [...current.messages, ...newMessages] : current.messages,
            currentSpeaker: nextSpeaker,
        }));

        if (nextSpeaker !== currentGameState.playerCountryName) {
            setTimeout(() => advanceChatTurn(chatId, false), 1500);
        }
    } catch (e) {
        console.error("Failed to advance chat turn", e);
        updateChat(chatId, { currentSpeaker: currentGameState.playerCountryName });
    }
  };

  const handleSendMessage = (chatId: string, messageText: string) => {
    if (!gameState || !gameState.playerCountryName) return;
    const newMessage: ChatMessage = { sender: gameState.playerCountryName, text: messageText };
    updateChat(chatId, current => ({ messages: [...current.messages, newMessage] }));
    setTimeout(() => advanceChatTurn(chatId, false), 100);
  };
  
  const handleDelegateTurn = (chatId: string) => advanceChatTurn(chatId, true);
  const handleInterrupt = (chatId: string) => {
    if (!gameState || !gameState.playerCountryName) return;
    updateChat(chatId, { currentSpeaker: gameState.playerCountryName });
  };

  const handleDeclineInvitation = (invitationToDecline: WorldEvent) => {
    setGameState(prev => {
        if (!prev) return null;
        return {
            ...prev,
            pendingInvitations: prev.pendingInvitations.filter(inv => inv !== invitationToDecline)
        }
    });
  };

  const handleAcceptInvitation = (invitation: WorldEvent): string => {
    if (!gameState || !invitation.chatInitiator || !invitation.chatParticipants) return '';
    
    const chatId = `chat_${Date.now()}`;
    const newChat: DiplomaticChat = {
      id: chatId,
      participants: invitation.chatParticipants,
      messages: [{ sender: invitation.chatInitiator, text: invitation.description }],
      topic: invitation.description, // BUG FIX: Use description for topic
      currentSpeaker: invitation.chatInitiator === gameState.playerCountryName 
          ? null // Let AI decide if player was somehow the initiator
          : invitation.chatInitiator,
    };

    setGameState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          chats: { ...prev.chats, [chatId]: newChat },
          pendingInvitations: prev.pendingInvitations.filter(inv => inv !== invitation)
        };
    });

    if (newChat.currentSpeaker !== gameState.playerCountryName) {
        setTimeout(() => advanceChatTurn(chatId, false), 500);
    }
    return chatId;
  };

  const handleLoadGame = (loadedGameState: GameState) => {
    if (loadedGameState && loadedGameState.countries && loadedGameState.year) {
        setGameState(loadedGameState);
        setGamePhase(GamePhase.PLAYING);
    } else {
        alert("Invalid or corrupted save file.");
    }
  };

  if (error) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-red-900 text-white p-4">
            <div className="bg-red-700 p-8 rounded-lg shadow-lg text-center">
                <h1 className="text-2xl font-bold mb-4">A Critical Error Occurred</h1>
                <p>{error}</p>
            </div>
        </div>
    );
  }
  
  if (gamePhase === GamePhase.LOADING || !gameState || !mapData) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading World Atlas...</div>;
  }

  if (gamePhase === GamePhase.SELECTION) {
    return <CountrySelectionScreen countries={gameState.countries} territories={gameState.territories} mapData={mapData} onSelect={handleCountrySelect} />;
  }

  if (gamePhase === GamePhase.PLAYING) {
    return (
      <GameUI
        gameState={gameState}
        mapData={mapData}
        onNewEvents={handleNewEvents}
        pendingInvitations={gameState.pendingInvitations}
        onCreateChat={handleCreateChat}
        onAcceptInvitation={handleAcceptInvitation}
        onDeclineInvitation={handleDeclineInvitation}
        onSendMessage={handleSendMessage}
        onDelegateTurn={handleDelegateTurn}
        onInterrupt={handleInterrupt}
        onLoadGame={handleLoadGame}
      />
    );
  }

  return null;
}
