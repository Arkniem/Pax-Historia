import { GoogleGenAI, Type } from "@google/genai";
import { GameState, WorldEvent, Country, AdvisorSuggestion, City, DiplomaticChat, UnitType, MilitaryUnit, UnitActionOutcome, PartialMilitaryUnit } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const eventSchema = {
    type: Type.ARRAY,
    description: "A list of geopolitical events that have occurred in the world.",
    items: {
        type: Type.OBJECT,
        properties: {
            type: {
                type: Type.STRING,
                enum: ['ALLIANCE', 'ANNEXATION', 'TRADE_DEAL', 'WAR', 'PEACE', 'NARRATIVE', 'COUNTRY_FORMATION', 'ECONOMIC_SHIFT', 'CITY_RENAMED', 'CITY_DESTROYED', 'CITY_FOUNDED', 'CHAT_INVITATION', 'DEPLOY_UNIT', 'MANUFACTURE_COMPLETE', 'SCRAP_UNIT'],
                description: 'The type of event that occurred.'
            },
            countries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'A list of country names involved. For ANNEXATION, first is aggressor, second is target. For DEPLOY_UNIT/MANUFACTURE_COMPLETE, the first (and only) is the relevant country.'
            },
            description: {
                type: Type.STRING,
                description: 'A human-readable description of the event for the event log.'
            },
            territoryNames: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'OPTIONAL: For regional annexation or country formation, specify the territory names involved.'
            },
            newCountryName: {
                type: Type.STRING,
                description: 'OPTIONAL: For COUNTRY_FORMATION events, specify the name of the new country being formed.'
            },
            date: {
                type: Type.STRING,
                description: "The specific date of the event in YYYY-MM-DD format. Must be within the current game year."
            },
            economicEffects: {
                type: Type.ARRAY,
                description: "OPTIONAL: A list of specific economic, population, and military changes to apply to countries as a result of this event.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        country: { type: Type.STRING, description: "The name of the country affected." },
                        gdpChange: { type: Type.NUMBER, description: "The change in GDP (in billions USD). Can be positive or negative." },
                        populationChange: { type: Type.NUMBER, description: "The change in population (in millions). Can be positive or negative." },
                        stabilityChange: { type: Type.NUMBER, description: "The change in stability (percentage points, -100 to 100)." },
                        militaryStrengthChange: { type: Type.NUMBER, description: "The change in the abstract military strength score. Can be positive or negative." },
                        newResources: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of new resources discovered or acquired." }
                    },
                    required: ['country']
                }
            },
            cityName: {
                type: Type.STRING,
                description: "OPTIONAL: For CITY_RENAMED or CITY_DESTROYED, the current name of the target city."
            },
            newCityName: {
                type: Type.STRING,
                description: "OPTIONAL: For CITY_RENAMED, the new name for the city. For CITY_FOUNDED, the name of the new city. For MANUFACTURE_COMPLETE, the name of the new unit design or class."
            },
            territoryForNewCity: {
                type: Type.STRING,
                description: "OPTIONAL: For CITY_FOUNDED, the name of the territory where the new city is founded."
            },
            newCityCoordinates: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "OPTIONAL: For CITY_FOUNDED, the [longitude, latitude] coordinates for the new city."
            },
            chatInitiator: {
                type: Type.STRING,
                description: "OPTIONAL: For CHAT_INVITATION, the name of the country initiating the chat."
            },
            chatParticipants: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "OPTIONAL: For CHAT_INVITATION, the list of all countries invited to the chat, including the player and initiator."
            },
            unitType: {
                type: Type.STRING,
                enum: ['ARMY', 'NAVY', 'AIR_FORCE'],
                description: "REQUIRED for DEPLOY_UNIT and MANUFACTURE_COMPLETE: The type of military unit."
            },
            locationDescription: {
                type: Type.STRING,
                description: "REQUIRED for DEPLOY_UNIT: A textual description of where the unit should be deployed (e.g., 'The English Channel', 'The Amazon Rainforest')."
            },
            maxUnitChange: {
                type: Type.NUMBER,
                description: "OPTIONAL for MANUFACTURE_COMPLETE: The number to increase the max unit capacity by (e.g., 1)."
            },
            unitId: {
                type: Type.STRING,
                description: "REQUIRED for SCRAP_UNIT: The ID of the specific military unit to be decommissioned. You MUST get this from the 'Current Military Deployments' list."
            },
        },
        required: ['type', 'description', 'countries', 'date']
    }
};


export async function simulateWorldEvents(gameState: GameState, playerAction: string, diplomaticLog: string): Promise<WorldEvent[]> {
    if (!gameState.playerCountryName) {
        throw new Error("Player country not set.");
    }

    const recentEventsSummary = gameState.events
        .slice(0, 20) // Provide context of the last 20 events.
        .map(e => `[${e.date}] ${e.description}`)
        .join('\n');
    
    const worldStateSummary = Object.values(gameState.territories)
        .map(t => `${t.name} (Original country: ${t.parentCountryName}) is owned by ${t.owner}.`)
        .join(' ');

    const citySummary = gameState.cities.map(c => `${c.name} (${c.territoryId})`).join(', ');

    const economicStateSummary = Object.values(gameState.countries)
        .map(c => `${c.name} (GDP: ${c.gdp}B, Population: ${c.population}M, Stability: ${c.stability}%, Military: ${c.militaryStrength}, Tech: ${c.militaryTech}, Resources: ${c.resources.join(', ') || 'None'})`)
        .join('\n');
    
    const militaryUnitSummary = Object.values(gameState.militaryUnits)
        .map(u => `ID: ${u.id} | ${u.owner}'s unit '${u.name}' (${u.type}) is at [${u.coordinates[0].toFixed(2)}, ${u.coordinates[1].toFixed(2)}]. Strength: ${u.strength}. Order: ${u.currentOrder}`)
        .join('\n');
        
    const arsenalSummary = Object.entries(gameState.arsenal).slice(0, 15).map(([country, arsenal]) => {
        const navy = `Navy(${arsenal.NAVY.unitNames.length}/${arsenal.NAVY.maxUnits})`;
        const army = `Army(${arsenal.ARMY.unitNames.length}/${arsenal.ARMY.maxUnits})`;
        const air = `Air(${arsenal.AIR_FORCE.unitNames.length}/${arsenal.AIR_FORCE.maxUnits})`;
        return `${country}: ${navy}, ${army}, ${air}`;
    }).join('; ');

    const diplomaticContext = diplomaticLog.trim() 
        ? `Consider the following diplomatic discussions that just occurred:\n${diplomaticLog}` 
        : "No major diplomatic discussions were held this year.";

    const prompt = `
        You are a realistic geopolitical and economic simulator (OVERSEER AI). The current year is ${gameState.year}.
        The player controls ${gameState.playerCountryName}.
        The player's national action this year is: "${playerAction}"

        CRITICAL INSTRUCTION: Your simulation must be realistic. A country's economic power (GDP, resources), population, stability, and military strength are paramount. A small, weak nation cannot conquer a superpower. An action's outcome must be proportional to the country's capabilities. If an action is outrageous (e.g., 'Luxembourg annexes China'), generate events describing the diplomatic fallout, economic sanctions, or utter failure.

        DYNAMIC MILITARY LIFECYCLE (OVERSEER AI):
        - You now control the full lifecycle of military units for ALL countries.
        - MANUFACTURING: Use 'MANUFACTURE_COMPLETE' to add new units to a country's arsenal or increase its capacity. This should be a reward for economic growth, technological advancement, or strategic focus. For this event, specify 'unitType'. You can either add a 'newUnitName' to their list of available named units (e.g., for a new aircraft carrier) OR you can use 'maxUnitChange' to increase their total deployment limit for that unit type. Do not use both at once. The country is in 'countries'.
        - DEPLOYMENT: Use 'DEPLOY_UNIT' to place units on the map from a country's available arsenal. This should be a strategic decision based on global tensions or national goals. You MUST specify 'unitType' and a 'locationDescription'.
        - SCRAPPING: Use 'SCRAP_UNIT' to decommission and remove a unit from the map. Do this to replace outdated units with modern ones, to free up arsenal capacity for a more strategic unit, or for economic reasons. You MUST provide the unit's exact 'unitId' from the 'Current Military Deployments' list.

        DIPLOMACY EVENTS: You can generate 'CHAT_INVITATION' events sparingly for MAJOR diplomatic reasons. You MUST specify 'chatInitiator' and 'chatParticipants'.

        DYNAMIC CITY EVENTS: You can manipulate cities.
        - CITY_FOUNDED: Create a new city. Provide 'newCityName', 'territoryForNewCity', and 'newCityCoordinates'.
        - CITY_RENAMED: Rename an existing city. Provide 'cityName' and 'newCityName'.
        - CITY_DESTROYED: Remove a city from the map. Provide 'cityName'.
        
        DYNAMIC STATS: You MUST model economic, population, and military changes using 'economicEffects'. Any event can have these consequences.

        COUNTRY FORMATION: You can introduce 'COUNTRY_FORMATION' events for secessions or new nations.

        World State (Territorial Ownership):
        ${worldStateSummary}

        World City State:
        ${citySummary}
        
        Current Military Deployments (with IDs for scrapping):
        ${militaryUnitSummary || "No major units are deployed."}
        
        National Arsenals (Named Units Available / Max Deployed):
        ${arsenalSummary}

        World Economic & Military State:
        ${economicStateSummary}

        Recent History (a log of major past events):
        ${recentEventsSummary}

        Diplomatic Context from this year's talks:
        ${diplomaticContext}

        Based on ALL available context (territorial, economic, military, arsenal, historical, diplomatic), simulate a series of consequential events for the next year.
        - For each event, provide a plausible, specific date within the year ${gameState.year} in 'YYYY-MM-DD' format.
        - Return the list of events sorted chronologically by date.
    `;


    try {
        const response = await ai.models.generateContent({
            // FIX: Use a recommended model from the guidelines.
            model: "gemini-2.5-Pro",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: eventSchema,
            },
        });

        const jsonText = response.text.trim();
        const events = JSON.parse(jsonText);
        
        if (!Array.isArray(events)) {
            throw new Error("AI response is not a valid event array.");
        }
        
        return events as WorldEvent[];

    } catch (error) {
        console.error("Error calling Gemini API for world simulation:", error);
        return [{
            type: 'NARRATIVE',
            countries: [],
            description: `The simulation AI encountered a paradox and failed to predict the future. The world holds its breath. Your action was: "${playerAction}"`,
            date: `${gameState.year}-12-31`
        }];
    }
}

const groupChatTurnSchema = {
    type: Type.OBJECT,
    properties: {
        nextSpeaker: {
            type: Type.STRING,
            description: "The name of the country that should speak next. Choose the most logical participant based on the last message."
        },
        message: {
            type: Type.STRING,
            description: "If the next speaker is an AI, this is the message they will say. If the next speaker is the player, this field should be an empty string."
        }
    },
    required: ['nextSpeaker', 'message']
};


export async function getGroupChatTurn(
    gameState: GameState,
    chat: DiplomaticChat,
    isDelegation: boolean = false
): Promise<{ nextSpeaker: string; message: string }> {
     if (!gameState.playerCountryName) {
        throw new Error("Player country not set.");
    }
    
    const allCurrentParticipants = new Set(chat.participants);
    const previousConversationsSummary = Object.values(gameState.chats)
        .filter(c => 
            c.id !== chat.id && 
            c.messages.length > 0 && 
            c.participants.some(p => allCurrentParticipants.has(p))
        )
        .map(c => {
            const history = c.messages.slice(-4).map(m => `${m.sender}: ${m.text}`).join('\n');
            return `From a past discussion on "${c.topic}":\n${history}`;
        })
        .join('\n\n');

    const participantDetails = chat.participants.map(pName => {
        const pData = gameState.countries[pName];
        if (!pData) return `${pName} (Details unknown)`;
        return `${pName} (Stability: ${pData.stability}%, Military: ${pData.militaryStrength}, GDP: ${pData.gdp}B)`;
    }).join('\n');

    const chatHistory = chat.messages.map(m => `${m.sender}: ${m.text}`).join('\n');
    const isNewChat = chat.messages.length === 0;
    const lastMessage = isNewChat ? null : chat.messages[chat.messages.length - 1];
    const otherParticipants = chat.participants.filter(p => p !== gameState.playerCountryName);

    const prompt = `
        You are a master diplomat AI, facilitating a conversation between world leaders.
        The current year is ${gameState.year}. The player controls ${gameState.playerCountryName}.

        ${previousConversationsSummary ? `IMPORTANT CONTEXT FROM PAST CONVERSATIONS (You must be consistent with this history):\n${previousConversationsSummary}\n\n` : ''}

        The topic of this conversation is: "${chat.topic}"

        Participants in this conversation:
        ${participantDetails}
        
        ${isNewChat 
            ? "This is the beginning of the conversation." 
            : `The conversation history so far:\n${chatHistory}`
        }

        ${isNewChat 
            ? "" 
            : `The last message was from ${lastMessage!.sender}: "${lastMessage!.text}"`
        }

        Your task is to determine who should speak next.
        1.  Analyze the ${isNewChat ? "topic" : "last message"} and the conversation context. ${isNewChat ? "Who should logically speak first?" : "Who is being addressed? Whose response is most anticipated or logical?"}
        
        ${isDelegation ? 
            `CRITICAL INSTRUCTION: The player (${gameState.playerCountryName}) has just delegated their turn. You MUST choose the next speaker from the other participants. DO NOT choose ${gameState.playerCountryName}. Your choice must be from this list: [${otherParticipants.join(', ')}].`
            : `2.  Choose the next speaker from the list of all participants: [${chat.participants.join(', ')}].`
        }

        3.  If you choose an AI leader to speak, craft a brief, in-character response for them. Their personality should be strategic, cautious, and patriotic, reflecting their nation's status and relationship with others in the chat.
        4.  If you choose the player (${gameState.playerCountryName}) to speak, they will provide their own message. (This is only allowed if the player did not just delegate their turn).

        Return your decision in the specified JSON format.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: groupChatTurnSchema
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for group chat turn:", error);
        // Fallback: Default to the player's turn on error
        if (isDelegation && otherParticipants.length > 0) {
            return {
                nextSpeaker: otherParticipants[0], // Pick someone else if possible
                message: `The diplomatic corps seems confused by ${gameState.playerCountryName}'s silence, so I will speak.`
            }
        }
        return { 
            nextSpeaker: gameState.playerCountryName,
            message: isNewChat 
                ? "A diplomatic courier seems to have gotten lost. It appears it's your turn to start the conversation."
                : "A diplomatic courier seems to have gotten lost. It appears it's your turn to speak."
        };
    }
}

const advisorSchema = {
    type: Type.OBJECT,
    properties: {
        suggestion: {
            type: Type.STRING,
            description: "The revised, improved version of the player's message."
        },
        reasoning: {
            type: Type.STRING,
            description: "A brief, clear explanation for why the changes were made, explaining the diplomatic strategy."
        }
    },
    required: ['suggestion', 'reasoning']
};

export async function getAdvisorResponse(
    gameState: GameState,
    chat: DiplomaticChat,
    playerMessage: string,
): Promise<AdvisorSuggestion> {
    if (!gameState.playerCountryName) {
        throw new Error("Player country not set.");
    }
    const playerCountry = gameState.countries[gameState.playerCountryName];
    const chatHistory = chat.messages.map(m => `${m.sender}: ${m.text}`).join('\n');
    
    const participantsDetails = chat.participants
        .map(pName => {
            const pData = gameState.countries[pName];
            if (!pData) return `- ${pName} (Details unknown)`;
            const role = pName === playerCountry.name ? "(Your Nation)" : "";
            return `- ${pName} ${role}: GDP: ${pData.gdp}B, Pop: ${pData.population}M, Stability: ${pData.stability}%, Military: ${pData.militaryStrength}`;
        })
        .join('\n');

    const prompt = `
        You are a seasoned and shrewd diplomatic advisor serving the leader of ${playerCountry.name}.
        The current year is ${gameState.year}.
        Your leader is in a diplomatic conversation regarding "${chat.topic}".

        Participants in this conversation:
        ${participantsDetails}

        Conversation History:
        ${chatHistory.trim() ? chatHistory : "This is the start of the conversation."}

        Your leader has drafted the following message to send:
        "${playerMessage}"

        Your task is to analyze this message and improve it. Your goal is to be effective, not just polite. Consider the geopolitical context, the power dynamics between ALL nations involved, and the conversation history. If this is a group chat, your advice MUST account for how every participant will perceive the message. The revised message should be strategic, advancing your nation's interests in this multi-party discussion.

        Provide your response in two parts:
        1.  **suggestion**: The improved message, ready to be sent. It should be written from the perspective of your leader.
        2.  **reasoning**: A concise explanation of your strategic thinking. Why is your version better? What diplomatic pitfalls does it avoid? What opportunities does it create?
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: advisorSchema,
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
}

export async function getGeneralAdvice(gameState: GameState, question: string): Promise<string> {
    if (!gameState.playerCountryName) {
        throw new Error("Player country not set.");
    }
    const playerCountry = gameState.countries[gameState.playerCountryName];
    const worldStateSummary = Object.values(gameState.countries)
        .map(c => `${c.name} (Stab: ${c.stability}%, Mil: ${c.militaryStrength})`)
        .slice(0, 20)
        .join(', ');

    const prompt = `
        You are a grand strategy advisor to the leader of ${playerCountry.name}. The year is ${gameState.year}.
        Your Nation's Status: GDP: ${playerCountry.gdp}B, Pop: ${playerCountry.population}M, Stability: ${playerCountry.stability}%, Military: ${playerCountry.militaryStrength}.
        World context: ${worldStateSummary}.
        Your leader asks: "${question}"
        Provide concise, actionable advice. Focus on strategy, economics, and diplomacy.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });
    return response.text.trim();
}

const partialMilitaryUnitSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "A realistic name for the military unit (e.g., '1st Armored Division', 'USS Nimitz Carrier Strike Group')." },
        leader: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "A plausible name for the unit's commanding officer." },
                rank: { type: Type.STRING, description: "A plausible rank for the commanding officer (e.g., 'General', 'Admiral', 'Air Marshal')." }
            },
            required: ['name', 'rank']
        },
        composition: {
            type: Type.ARRAY,
            description: "A list of sub-units and their primary equipment.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Name of the sub-unit (e.g., '3rd Brigade Combat Team', 'Destroyer Squadron 23', 'No. 1 Fighter Squadron')." },
                    equipment: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of key equipment for this sub-unit (e.g., 'M1 Abrams Tanks', 'F/A-18 Super Hornets', 'Arleigh Burke-class destroyers')."
                    }
                },
                required: ['name', 'equipment']
            }
        },
        strength: { type: Type.NUMBER, description: "An abstract combat strength score for this unit, from 1 to 100, proportional to the nation's total military strength." }
    },
    required: ['name', 'leader', 'composition', 'strength']
};

const newUnitSchema = {
    type: Type.OBJECT,
    properties: {
        ...partialMilitaryUnitSchema.properties,
        type: {
            type: Type.STRING,
            enum: ['ARMY', 'NAVY', 'AIR_FORCE'],
            description: "The type of the unit."
        },
        initialOrder: { type: Type.STRING, description: "A concise initial order for the unit, derived from the deployment brief." },
        coordinates: {
            type: Type.ARRAY,
            description: "The [longitude, latitude] for this specific unit's deployment.",
            items: { type: Type.NUMBER }
        },
    },
    required: [...partialMilitaryUnitSchema.required, 'type', 'initialOrder', 'coordinates']
};

const deploymentSchema = {
    type: Type.ARRAY,
    description: "A list of military units to be deployed.",
    items: newUnitSchema,
};

export async function generateDeploymentFromBrief(
    country: Country,
    locationDescription: string,
    deploymentBrief: string,
    gameState: GameState
): Promise<(PartialMilitaryUnit & { initialOrder: string; type: UnitType; coordinates: [number, number] })[]> {
    const countryArsenal = gameState.arsenal[country.name];
    const currentCounts = {
        [UnitType.ARMY]: Object.values(gameState.militaryUnits).filter(u => u.owner === country.name && u.type === UnitType.ARMY).length,
        [UnitType.NAVY]: Object.values(gameState.militaryUnits).filter(u => u.owner === country.name && u.type === UnitType.NAVY).length,
        [UnitType.AIR_FORCE]: Object.values(gameState.militaryUnits).filter(u => u.owner === country.name && u.type === UnitType.AIR_FORCE).length,
    };
    
    const arsenalSummaryForCountry = `
        - Army: ${currentCounts.ARMY}/${countryArsenal.ARMY.maxUnits} deployed.
        - Navy: ${currentCounts.NAVY}/${countryArsenal.NAVY.maxUnits} deployed. Available named units: ${countryArsenal.NAVY.unitNames.join(', ') || 'None'}.
        - Air Force: ${currentCounts.AIR_FORCE}/${countryArsenal.AIR_FORCE.maxUnits} deployed.
    `;

    const prompt = `
        You are a military deployment coordinator AI. The current year is ${gameState.year}.
        The country is ${country.name}, with a military strength of ${country.militaryStrength}, tech level ${country.militaryTech}/10.

        The commander has issued the following deployment order:
        - Brief: "${deploymentBrief}"
        - Location: "${locationDescription}"

        Your tasks:
        1.  **Analyze the Brief**: Interpret the brief to determine the number and types of units to deploy. For example, "Deploy two armored divisions and a carrier group" means you should generate three units in total.
        2.  **Check Arsenal**: Review the country's arsenal. You MUST NOT generate more units of a given type than they have capacity for. If the brief requests a specific named unit (like an aircraft carrier), you MUST use an available name from their arsenal list.
            - Arsenal Capacity for ${country.name}: ${arsenalSummaryForCountry}
        3.  **Generate Unit Details**: For EACH unit identified in the brief, generate plausible details:
            - \`type\`: The unit's type (ARMY, NAVY, AIR_FORCE).
            - \`name\`: A realistic name. Use a specific name from the arsenal if applicable.
            - \`leader\`, \`composition\`, \`strength\`: Details must be realistic for ${country.name} and its tech level.
            - \`initialOrder\`: A concise summary of the unit's mission from the brief.
        4.  **Determine Coordinates**: For EACH unit, calculate a plausible deployment coordinate pair [longitude, latitude] based on the location description "${locationDescription}".
            - **CRITICAL CONSTRAINT**: You MUST place NAVY units in a body of water (ocean, sea) and ARMY/AIR_FORCE units on a valid landmass. If the location is ambiguous (e.g., "the coast of France"), place the navy units just offshore and the army units just onshore. Do not place units in Antarctica.
        5.  **Final Output**: Return an array of all the generated unit objects in the specified JSON format. If the brief is impossible, nonsensical, or clearly violates arsenal limits, return an empty array.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: deploymentSchema
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error calling Gemini API for multi-unit deployment:", error);
        throw new Error("The AI could not interpret the deployment brief. Please try a clearer or more realistic request.");
    }
}


const unitActionOutcomeSchema = {
    type: Type.OBJECT,
    properties: {
        actionType: {
            type: Type.STRING,
            enum: ['RELOCATE', 'RETREAT', 'SPLIT', 'MERGE', 'GENERAL_ORDER'],
            description: "The type of action identified from the order."
        },
        outcomeText: {
            type: Type.STRING,
            description: "A concise, narrative description of the outcome of the military unit's order."
        },
        newCoordinates: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: "OPTIONAL for RELOCATE/RETREAT: [longitude, latitude] for the new location."
        },
        newUnitsToCreate: {
            type: Type.ARRAY,
            description: "OPTIONAL for SPLIT: An array of new, smaller units to create from the original.",
            items: partialMilitaryUnitSchema
        },
        mergedUnit: {
            type: Type.OBJECT,
            description: "OPTIONAL for MERGE: The new, combined unit.",
            properties: partialMilitaryUnitSchema.properties,
        },
        unitIdsToRemove: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "OPTIONAL for SPLIT/MERGE: List of unit IDs to remove from the map. For SPLIT, this is the original unit. For MERGE, this includes all units that were combined."
        },
    },
    required: ['actionType', 'outcomeText']
};

export async function getUnitActionOutcome(gameState: GameState, unit: MilitaryUnit, order: string): Promise<UnitActionOutcome> {
    const nearbyUnits = Object.values(gameState.militaryUnits).filter(u => {
        if (u.id === unit.id || u.owner !== unit.owner) return false;
        const dist = Math.sqrt(
            Math.pow(u.coordinates[0] - unit.coordinates[0], 2) +
            Math.pow(u.coordinates[1] - unit.coordinates[1], 2)
        );
        return dist < 15; // Define "nearby" as within 15 degrees lat/lon
    });

    const nearbyUnitsSummary = nearbyUnits.length > 0
        ? `Nearby friendly units available for merging:\n${nearbyUnits.map(u => `- ID: ${u.id}, Name: ${u.name}, Strength: ${u.strength}, Commander: ${u.leader.rank} ${u.leader.name}`).join('\n')}`
        : "No friendly units are nearby for a potential merge.";

    const prompt = `
        You are a military command and control simulator AI. The current year is ${gameState.year}.
        A unit is being given an order.

        Unit Details:
        - ID: ${unit.id}
        - Name: ${unit.name} (${unit.type})
        - Owner: ${unit.owner}
        - Location: [${unit.coordinates[0].toFixed(2)}, ${unit.coordinates[1].toFixed(2)}]
        - Strength: ${unit.strength}
        - Commander: ${unit.leader.rank} ${unit.leader.name}
        - Composition: ${unit.composition.map(c => c.name).join(', ')}

        The order given to this unit is: "${order}"

        Your task is to analyze this order and generate a structured outcome. You must identify the action type and provide the necessary data.

        ACTION TYPES:
        1. RELOCATE/RETREAT: If the order is to move (e.g., "relocate to the Pacific", "retreat to home base").
           - actionType: 'RELOCATE' or 'RETREAT'.
           - newCoordinates: Calculate plausible [longitude, latitude] for the destination.
           - outcomeText: Describe the movement.

        2. SPLIT: If the order is to divide into smaller groups (e.g., "split into two patrol groups").
           - actionType: 'SPLIT'.
           - newUnitsToCreate: Create 2 or more new smaller units. Their combined strength should be roughly equal to the original unit's strength. Give them new plausible names (e.g., '1st Patrol Group', '2nd Patrol Group') and divide the composition and leadership plausibly.
           - unitIdsToRemove: The ID of the original unit being split: ["${unit.id}"].
           - outcomeText: Describe the unit splitting.

        3. MERGE: If the order is to combine with other units (e.g., "merge with nearby forces", "form a strike group").
           - actionType: 'MERGE'.
           - Identify which of the nearby friendly units should be merged based on the order.
           - mergedUnit: Create one new, powerful unit. Its name should reflect its new status (e.g., '1st Combined Strike Group'). Its strength and composition should be the sum of the merged units. CRITICAL: The leader of the new unit MUST be the highest-ranking officer from all the merged units. You must compare ranks (e.g., General > Colonel, Admiral > Captain) to determine this.
           - unitIdsToRemove: Provide a list of ALL unit IDs that were merged, including the original unit.
           - outcomeText: Describe the merge and name the new commander.
           - ${nearbyUnitsSummary}

        4. GENERAL_ORDER: For any other order (e.g., "patrol the area", "begin exercises", "attack target X").
           - actionType: 'GENERAL_ORDER'.
           - outcomeText: Provide a narrative outcome reflecting the plausibility of the order. An order for a single fleet to "conquer Russia" should fail, while an order to "patrol the Mediterranean" should succeed.

        CRITICAL: Only provide the fields relevant to the detected actionType. For example, do not provide 'newCoordinates' for a 'SPLIT' action.
    `;
     try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: unitActionOutcomeSchema
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error calling Gemini API for unit action outcome:", error);
        return {
            actionType: 'GENERAL_ORDER',
            outcomeText: "The unit's command structure was unable to process the order due to a communications breakdown. The order was not carried out.",
        };
    }
}