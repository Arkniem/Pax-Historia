
import { GoogleGenAI, Type } from "@google/genai";
import { GameState, WorldEvent, Country, AdvisorSuggestion, City, DiplomaticChat } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const eventSchema = {
    type: Type.ARRAY,
    description: "A list of geopolitical events that have occurred in the world.",
    items: {
        type: Type.OBJECT,
        properties: {
            type: {
                type: Type.STRING,
                enum: ['ALLIANCE', 'ANNEXATION', 'TRADE_DEAL', 'WAR', 'PEACE', 'NARRATIVE', 'COUNTRY_FORMATION', 'ECONOMIC_SHIFT', 'CITY_RENAMED', 'CITY_DESTROYED', 'CITY_FOUNDED', 'CHAT_INVITATION'],
                description: 'The type of event that occurred.'
            },
            countries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'A list of country names involved in the event. For ANNEXATION, the first is the aggressor, the second is the target.'
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
                description: "OPTIONAL: For CITY_RENAMED, the new name for the city. For CITY_FOUNDED, the name of the new city."
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

    const diplomaticContext = diplomaticLog.trim() 
        ? `Consider the following diplomatic discussions that just occurred:\n${diplomaticLog}` 
        : "No major diplomatic discussions were held this year.";

    const prompt = `
        You are a realistic geopolitical and economic simulator. The current year is ${gameState.year}.
        The player controls ${gameState.playerCountryName}.
        The player's national action this year is: "${playerAction}"

        CRITICAL INSTRUCTION: Your simulation must be realistic. A country's economic power (GDP, resources), population, stability, and military strength are paramount. A small, weak nation cannot conquer a superpower. An action's outcome must be proportional to the country's capabilities. If an action is outrageous (e.g., 'Luxembourg annexes China'), generate events describing the diplomatic fallout, economic sanctions, or utter failure.

        NEW DIPLOMACY EVENTS: You can now generate 'CHAT_INVITATION' events. This allows AI countries to proactively start conversations with the player and other AI nations. For this event type, you MUST specify 'chatInitiator' and 'chatParticipants'. This is a powerful tool to create dynamic international relations, alliances, or crises.

        NEW DYNAMIC CITY EVENTS: You can now manipulate cities.
        - CITY_FOUNDED: Create a new city. Provide 'newCityName', 'territoryForNewCity', and 'newCityCoordinates'. Do this for colonization, new capitals, etc. The coordinates must be realistic for the territory.
        - CITY_RENAMED: Rename an existing city, often after a conquest. Provide 'cityName' (the old name) and 'newCityName'.
        - CITY_DESTROYED: Remove a city from the map, a rare event for cataclysms or total war. Provide 'cityName'.

        NEW DYNAMIC STATS:
        - You MUST model economic, population, and military changes using the 'economicEffects' field.
        - Any event (war, trade, annexation, etc.) can have economic and military consequences.
        - Use the 'ECONOMIC_SHIFT' event type for purely economic events like recessions, technological booms, or resource discoveries.

        NEW DYNAMIC EVENT: You can introduce 'COUNTRY_FORMATION' events. This can happen when an ungoverned territory establishes a formal government, or when a region or group of regions secedes from an existing country to form a new nation.

        World State (Territorial Ownership):
        ${worldStateSummary}

        World City State:
        ${citySummary}

        World Economic & Military State:
        ${economicStateSummary}

        Recent History (a log of major past events):
        ${recentEventsSummary}

        Diplomatic Context from this year's talks:
        ${diplomaticContext}

        Based on ALL available context (territorial, economic, military, historical, diplomatic), simulate a series of consequential events for the next year.
        - For each event, provide a plausible, specific date within the year ${gameState.year} in 'YYYY-MM-DD' format.
        - Return the list of events sorted chronologically by date.
    `;


    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
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
            model: "gemini-2.5-flash",
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
        if (isDelegation) {
            return {
                nextSpeaker: gameState.playerCountryName,
                message: "Your attempt to delegate was unclear to the diplomatic corps. The floor returns to you."
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
    targetCountryName: string,
    playerMessage: string,
    chatHistory: string,
): Promise<AdvisorSuggestion> {
    if (!gameState.playerCountryName) {
        throw new Error("Player country not set.");
    }
    const playerCountry = gameState.countries[gameState.playerCountryName];
    const targetCountry = gameState.countries[targetCountryName];

    const prompt = `
        You are a seasoned and shrewd diplomatic advisor serving the leader of ${playerCountry.name}.
        The current year is ${gameState.year}.
        Your leader is in a diplomatic conversation with ${targetCountryName}.

        Your Nation's Status:
        - GDP: ${playerCountry.gdp}B, Population: ${playerCountry.population}M, Stability: ${playerCountry.stability}%, Military: ${playerCountry.militaryStrength}

        Target Nation's Status:
        - GDP: ${targetCountry.gdp}B, Population: ${targetCountry.population}M, Stability: ${targetCountry.stability}%, Military: ${targetCountry.militaryStrength}

        Conversation History:
        ${chatHistory.trim() ? chatHistory : "This is the start of the conversation."}

        Your leader has drafted the following message to send:
        "${playerMessage}"

        Your task is to analyze this message and improve it. Your goal is to be effective, not just polite. Consider the geopolitical context, the power dynamics between the two nations, and the conversation history. The revised message should be strategic, advancing your nation's interests.

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
