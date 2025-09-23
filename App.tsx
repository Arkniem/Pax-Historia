
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { GameState, WorldEvent, GamePhase, MapData, Country, City, DiplomaticChat, ChatMessage, UnitType, MilitaryUnit, UnitActionOutcome, Toast, Territory } from './types';
import CountrySelectionScreen from './components/CountrySelectionScreen';
import GameUI from './components/GameUI';
import { generateInitialGameState, getCountryColor } from './services/stateService';
import { getGroupChatTurn, generateDeploymentFromBrief, getUnitActionOutcome } from './services/geminiService';

const atlasURLs: { [key: string]: string } = {
  world: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
  us: 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json',
};

// --- Toast Notification System ---
interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
}
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToasts = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToasts must be used within a ToastProvider');
  return context;
};

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: Toast['type']) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
    </ToastContext.Provider>
  );
};


const AppContent = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.LOADING);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToasts();
  
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

        // FIX: Explicitly type 't' as Territory to help TypeScript inference.
        const territory = Object.values(prevState.territories).find((t: Territory) => t.name === selectionName);
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
            color: getCountryColor(selectionName + " secession"), // Salt to get a different color
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
  
  const handleNewEvents = async (events: WorldEvent[]) => {
    const prevState = gameStateRef.current;
    if (!prevState) return;
  
    let state = {
      territories: { ...prevState.territories },
      countries: { ...prevState.countries },
      cities: [...prevState.cities],
      militaryUnits: { ...prevState.militaryUnits },
      arsenal: JSON.parse(JSON.stringify(prevState.arsenal)), // Deep copy
    };
  
    const processEconomicEffects = (event: WorldEvent) => {
      if (!event.economicEffects) return;
      event.economicEffects.forEach(effect => {
        const countryToUpdate = state.countries[effect.country];
        if (countryToUpdate) {
          const updatedCountry = { ...countryToUpdate };
          if (typeof effect.gdpChange === 'number') updatedCountry.gdp = Math.max(1, updatedCountry.gdp + effect.gdpChange);
          if (typeof effect.populationChange === 'number') updatedCountry.population = Math.max(0.1, updatedCountry.population + effect.populationChange);
          if (typeof effect.stabilityChange === 'number') updatedCountry.stability = Math.max(0, Math.min(100, updatedCountry.stability + effect.stabilityChange));
          if (typeof effect.militaryStrengthChange === 'number') updatedCountry.militaryStrength = Math.max(0, updatedCountry.militaryStrength + effect.militaryStrengthChange);
          if (effect.newResources) updatedCountry.resources = [...new Set([...updatedCountry.resources, ...effect.newResources])];
          state.countries[effect.country] = updatedCountry;
        }
      });
    };
  
    const eventHandlers: { [key in WorldEvent['type']]?: (event: WorldEvent) => Promise<void> | void } = {
      ANNEXATION: (event) => {
        if (event.countries.length !== 2) return;
        const [aggressorName, targetCountryName] = event.countries;
        if (event.territoryNames && event.territoryNames.length > 0) {
          event.territoryNames.forEach(name => {
            // FIX: Explicitly type 't' as Territory to help TypeScript inference.
            const territoryToUpdate = Object.values(state.territories).find((t: Territory) => t.name === name);
            if (territoryToUpdate) state.territories[territoryToUpdate.id] = { ...territoryToUpdate, owner: aggressorName };
          });
        } else {
          // FIX: Explicitly type 't' as Territory to help TypeScript inference.
          Object.values(state.territories).filter((t: Territory) => t.owner === targetCountryName).forEach((t: Territory) => {
            state.territories[t.id] = { ...t, owner: aggressorName };
          });
        }
      },
      COUNTRY_FORMATION: (event) => {
        const { newCountryName, territoryNames } = event;
        if (!newCountryName || !territoryNames) return;
        if (!state.countries[newCountryName]) {
          let hash = 0;
          for (let i = 0; i < newCountryName.length; i++) { hash = newCountryName.charCodeAt(i) + ((hash << 5) - hash); }
          state.countries[newCountryName] = { 
              name: newCountryName, color: getCountryColor(newCountryName), gdp: 5 + (Math.abs(hash) % 45),
              population: 1 + (Math.abs(hash) % 10), stability: 40 + (Math.abs(hash) % 20), resources: [],
              militaryStrength: 5 + (Math.abs(hash) % 15), militaryTech: 1 + (Math.abs(hash) % 4),
          };
        }
        territoryNames.forEach(name => {
          // FIX: Explicitly type 't' as Territory to help TypeScript inference.
          const territoryToUpdate = Object.values(state.territories).find((t: Territory) => t.name === name);
          if (territoryToUpdate) state.territories[territoryToUpdate.id] = { ...territoryToUpdate, owner: newCountryName };
        });
      },
      CITY_FOUNDED: (event) => {
        const { newCityName, territoryForNewCity, newCityCoordinates } = event;
        if (!newCityName || !territoryForNewCity || !newCityCoordinates) return;
        // FIX: Explicitly type 't' as Territory to help TypeScript inference.
        const territoryExists = Object.values(state.territories).find((t: Territory) => t.name === territoryForNewCity);
        if (territoryExists) {
          state.cities.push({ id: `${newCityName}-${Date.now()}`, name: newCityName, coordinates: newCityCoordinates, territoryId: territoryExists.id, isCapital: false });
        }
      },
      CITY_RENAMED: (event) => {
        if (event.cityName && event.newCityName) {
          state.cities = state.cities.map(city => city.name === event.cityName ? { ...city, name: event.newCityName, id: `${event.newCityName}-${city.territoryId}` } : city);
        }
      },
      CITY_DESTROYED: (event) => {
        if (event.cityName) state.cities = state.cities.filter(city => city.name !== event.cityName);
      },
      DEPLOY_UNIT: async (event) => {
        const countryName = event.countries[0];
        const country = state.countries[countryName];
        if (!country || !event.unitType || !event.locationDescription) return;
  
        const tempGameStateForApi = { ...prevState, ...state };
        // FIX: Explicitly type 'u' as MilitaryUnit to help TypeScript inference.
        const currentUnitCount = Object.values(state.militaryUnits).filter((u: MilitaryUnit) => u.owner === countryName && u.type === event.unitType).length;
        const maxUnits = tempGameStateForApi.arsenal[countryName]?.[event.unitType]?.maxUnits ?? 0;
  
        if (currentUnitCount >= maxUnits) {
          console.log(`AI for ${countryName} failed to deploy unit: maximum capacity reached for type ${event.unitType}.`);
          return;
        }
        try {
          const brief = `Deploy a standard ${event.unitType.toLowerCase().replace('_', ' ')} unit.`;
          const proposedUnits = await generateDeploymentFromBrief(country, event.locationDescription, brief, tempGameStateForApi);
          if (proposedUnits.length > 0) {
            const unitDetails = proposedUnits[0];
            const newUnit: MilitaryUnit = {
              id: `${country.name}-${unitDetails.type}-${Date.now()}`, owner: country.name, type: unitDetails.type,
              coordinates: unitDetails.coordinates, name: unitDetails.name || 'Unnamed Unit',
              leader: unitDetails.leader || { name: 'Unknown', rank: 'Unknown' }, composition: unitDetails.composition || [],
              strength: unitDetails.strength || 0, currentOrder: unitDetails.initialOrder || 'Awaiting orders.', ordersLog: [],
            };
            state.militaryUnits[newUnit.id] = newUnit;
          }
        } catch (e) {
          console.error(`AI for ${countryName} failed to deploy unit for event: ${event.description}. Reason:`, e);
        }
      },
      MANUFACTURE_COMPLETE: (event) => {
        if (event.countries.length < 1 || !event.unitType) return;
        const countryName = event.countries[0];
        const countryArsenal = state.arsenal[countryName];
        if (countryArsenal) {
          const unitArsenal = countryArsenal[event.unitType];
          if (event.newUnitName) unitArsenal.unitNames.push(event.newUnitName);
          if (typeof event.maxUnitChange === 'number') unitArsenal.maxUnits += event.maxUnitChange;
        }
      },
      SCRAP_UNIT: (event) => {
        if (event.unitId && state.militaryUnits[event.unitId]) {
          delete state.militaryUnits[event.unitId];
        }
      }
    };
  
    const reversedEvents = [...events].reverse();
    const chatInvitations = events.filter(e => e.type === 'CHAT_INVITATION');
  
    for (const event of reversedEvents) {
      processEconomicEffects(event);
      const handler = eventHandlers[event.type];
      if (handler) {
        await handler(event);
      }
    }
    
    setGameState({
      ...prevState,
      ...state,
      events: [...events, ...prevState.events],
      year: prevState.year + 1,
      pendingInvitations: [...prevState.pendingInvitations, ...chatInvitations],
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
        
        // After the API call, check the latest state.
        const stateAfterApi = gameStateRef.current;
        if (!stateAfterApi) return; // Should not happen but good practice
        const chatAfterApi = stateAfterApi.chats[chatId];
        
        // If speaker is not null, it means an interrupt or other state change happened.
        // Abort this turn to prevent overwriting the new state.
        if (chatAfterApi.currentSpeaker !== null) {
            return;
        }

        const newMessages: ChatMessage[] = message ? [{ sender: nextSpeaker, text: message }] : [];
        
        updateChat(chatId, current => ({
            messages: message ? [...current.messages, ...newMessages] : current.messages,
            currentSpeaker: nextSpeaker,
        }));

        if (nextSpeaker !== stateAfterApi.playerCountryName) {
            setTimeout(() => advanceChatTurn(chatId, false), 1500);
        }
    } catch (e) {
        console.error("Failed to advance chat turn", e);
        // Also check for interrupt on error before giving turn back to player
        const stateAfterError = gameStateRef.current;
        if (stateAfterError && stateAfterError.chats[chatId]?.currentSpeaker === null) {
            updateChat(chatId, { currentSpeaker: stateAfterError.playerCountryName });
        }
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
        const initialCoreState = generateInitialGameState(mapData!); // Get defaults for things like centroids and full arsenal
        const stateWithDefaults: GameState = {
            ...initialCoreState,
            ...loadedGameState,
            arsenal: loadedGameState.arsenal || initialCoreState.arsenal, // Use loaded arsenal, or fallback to default for old saves
            militaryUnits: loadedGameState.militaryUnits ? Object.fromEntries(
                Object.entries(loadedGameState.militaryUnits).map(([id, unit]) => [
                    id,
                    {
                        ...unit,
                        currentOrder: unit.currentOrder || 'Awaiting orders.',
                        ordersLog: unit.ordersLog || [],
                    }
                ])
            ) : {},
        };
        setGameState(stateWithDefaults);
        setGamePhase(GamePhase.PLAYING);
        addToast('Game loaded successfully!', 'success');
    } else {
        addToast('Invalid or corrupted save file.', 'error');
    }
  };

  const handleDeployUnit = async (locationDescription: string, deploymentBrief: string) => {
    if (!gameState || !gameState.playerCountryName) return;
    
    const country = gameState.countries[gameState.playerCountryName];
    if (!country) return;

    try {
        const proposedUnits = await generateDeploymentFromBrief(country, locationDescription, deploymentBrief, gameState);

        if (proposedUnits.length === 0) {
            addToast("Deployment failed: The AI could not create units based on your brief.", 'error');
            return;
        }

        // Validate against arsenal
        const currentCounts: { [key in UnitType]: number } = {
            // FIX: Explicitly type 'u' as MilitaryUnit to help TypeScript inference.
            [UnitType.ARMY]: Object.values(gameState.militaryUnits).filter((u: MilitaryUnit) => u.owner === country.name && u.type === UnitType.ARMY).length,
            // FIX: Explicitly type 'u' as MilitaryUnit to help TypeScript inference.
            [UnitType.NAVY]: Object.values(gameState.militaryUnits).filter((u: MilitaryUnit) => u.owner === country.name && u.type === UnitType.NAVY).length,
            // FIX: Explicitly type 'u' as MilitaryUnit to help TypeScript inference.
            [UnitType.AIR_FORCE]: Object.values(gameState.militaryUnits).filter((u: MilitaryUnit) => u.owner === country.name && u.type === UnitType.AIR_FORCE).length,
        };

        const proposedCounts = proposedUnits.reduce((acc, unit) => {
            acc[unit.type] = (acc[unit.type] || 0) + 1;
            return acc;
        }, {} as { [key in UnitType]?: number });

        for (const key of Object.keys(proposedCounts)) {
            const unitType = key as UnitType;
            const max = gameState.arsenal[country.name][unitType].maxUnits;
            const current = currentCounts[unitType];
            const proposed = proposedCounts[unitType] || 0;
            if (current + proposed > max) {
                addToast(`Deployment failed: You only have ${max - current}/${max} ${unitType.toLowerCase().replace('_', ' ')} slots available.`, 'error');
                return;
            }
        }
        
        const newUnits: MilitaryUnit[] = proposedUnits.map((unitDetails, index) => ({
            id: `${country.name}-${unitDetails.type}-${Date.now()}-${index}`,
            owner: country.name,
            type: unitDetails.type,
            coordinates: unitDetails.coordinates,
            name: unitDetails.name || 'Unnamed Unit',
            leader: unitDetails.leader || { name: 'Unknown', rank: 'Unknown' },
            composition: unitDetails.composition || [],
            strength: unitDetails.strength || 0,
            currentOrder: unitDetails.initialOrder || 'Awaiting orders.',
            ordersLog: [],
        }));

        setGameState(prev => {
            if (!prev) return null;
            const updatedMilitaryUnits = { ...prev.militaryUnits };
            newUnits.forEach(unit => {
                updatedMilitaryUnits[unit.id] = unit;
            });
            addToast(`${newUnits.length} unit(s) deployed successfully.`, 'success');
            return {
                ...prev,
                militaryUnits: updatedMilitaryUnits,
            };
        });
    } catch (e: any) {
        console.error("Failed to deploy unit(s)", e);
        addToast(`Deployment Failed: ${e.message || "An unknown error occurred."}`, 'error');
    }
  };
  
  const handleUnitOrder = async (unitId: string, order: string) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;
    const unit = currentState.militaryUnits[unitId];
    if (!unit) return;

    const outcome = await getUnitActionOutcome(currentState, unit, order);

    setGameState(prev => {
      if (!prev) return null;
      
      const newMilitaryUnits = { ...prev.militaryUnits };

      const updateLog = (targetUnit: MilitaryUnit, newOrder: string, newOutcome: string): MilitaryUnit => ({
        ...targetUnit,
        currentOrder: newOrder,
        ordersLog: [{ year: prev.year, order: newOrder, outcome: newOutcome }, ...targetUnit.ordersLog].slice(0, 10),
      });

      switch (outcome.actionType) {
        case 'RELOCATE':
        case 'RETREAT':
          if (outcome.newCoordinates) {
            const updatedUnit = { ...newMilitaryUnits[unitId], coordinates: outcome.newCoordinates as [number, number] };
            newMilitaryUnits[unitId] = updateLog(updatedUnit, order, outcome.outcomeText);
          }
          break;

        case 'SPLIT':
          if (outcome.unitIdsToRemove?.includes(unitId) && outcome.newUnitsToCreate) {
            delete newMilitaryUnits[unitId];
            outcome.newUnitsToCreate.forEach((partialUnit, index) => {
              const newUnit: MilitaryUnit = {
                ...partialUnit,
                id: `${unit.owner}-split-${Date.now()}-${index}`,
                owner: unit.owner,
                type: unit.type,
                coordinates: unit.coordinates,
                currentOrder: 'Awaiting orders.',
                ordersLog: [{ year: prev.year, order: 'Formed from split command', outcome: `Split from ${unit.name}` }],
              };
              newMilitaryUnits[newUnit.id] = newUnit;
            });
          }
          break;

        case 'MERGE':
          if (outcome.unitIdsToRemove && outcome.mergedUnit) {
            outcome.unitIdsToRemove.forEach(idToRemove => {
              delete newMilitaryUnits[idToRemove];
            });
            const mergedUnitData = outcome.mergedUnit;
            const newMergedUnit: MilitaryUnit = {
                ...mergedUnitData,
                id: `${unit.owner}-merged-${Date.now()}`,
                owner: unit.owner,
                type: unit.type,
                coordinates: unit.coordinates,
                currentOrder: order,
                ordersLog: [{ year: prev.year, order, outcome: outcome.outcomeText }],
            };
            newMilitaryUnits[newMergedUnit.id] = newMergedUnit;
          }
          break;
        
        case 'GENERAL_ORDER':
        default:
           if (newMilitaryUnits[unitId]) {
              newMilitaryUnits[unitId] = updateLog(newMilitaryUnits[unitId], order, outcome.outcomeText);
           }
          break;
      }
      
      return { ...prev, militaryUnits: newMilitaryUnits };
    });
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
        toasts={useToasts().toasts}
        onNewEvents={handleNewEvents}
        pendingInvitations={gameState.pendingInvitations}
        onCreateChat={handleCreateChat}
        onAcceptInvitation={handleAcceptInvitation}
        onDeclineInvitation={handleDeclineInvitation}
        onSendMessage={handleSendMessage}
        onDelegateTurn={handleDelegateTurn}
        onInterrupt={handleInterrupt}
        onLoadGame={handleLoadGame}
        onDeployUnit={handleDeployUnit}
        onUnitOrder={handleUnitOrder}
      />
    );
  }

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}