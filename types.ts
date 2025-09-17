export interface Territory {
  id: string; // geo.id or a generated one
  name: string; // Territory name (e.g., 'California' or 'France')
  parentCountryName: string; // The original country (e.g., 'United States of America' or 'France')
  owner: string; // Name of the country that currently owns this territory
}

export interface Country {
  name: string;
  color: string;
  gdp: number; // in billions
  population: number; // in millions
  stability: number; // 0-100
  resources: string[];
  militaryStrength: number; // Abstract score representing military power
  militaryTech: number; // Tech level from 1-10
  // Dynamic label properties
  labelName?: string; // Overrides 'name' for map display
  labelSizeModifier?: number; // e.g., 1.2 for 20% larger, 0.8 for 20% smaller
  labelCoordinates?: [number, number]; // [lon, lat] to override automatic centroid
}

export interface City {
  id: string; // Unique identifier, e.g., "Washington D.C.-USA-11"
  name: string;
  coordinates: [number, number]; // [lon, lat]
  territoryId: string;
  isCapital: boolean;
}

export interface GameState {
  territories: { [id: string]: Territory };
  countries: { [name: string]: Country };
  cities: City[];
  playerCountryName: string | null;
  year: number;
  events: WorldEvent[];
  chats: { [id: string]: DiplomaticChat };
  pendingInvitations: WorldEvent[];
}

export interface WorldEvent {
  type: 'ALLIANCE' | 'ANNEXATION' | 'TRADE_DEAL' | 'WAR' | 'PEACE' | 'NARRATIVE' | 'COUNTRY_FORMATION' | 'ECONOMIC_SHIFT' | 'CITY_RENAMED' | 'CITY_DESTROYED' | 'CITY_FOUNDED' | 'CHAT_INVITATION';
  countries: string[];
  description: string;
  territoryNames?: string[]; // e.g., ['California', 'Texas']
  newCountryName?: string; // e.g., 'Republic of Texas'
  date: string; // YYYY-MM-DD
  economicEffects?: {
    country: string;
    gdpChange?: number;
    populationChange?: number;
    stabilityChange?: number;
    militaryStrengthChange?: number;
    newResources?: string[];
  }[];
  // Fields for city-related events
  cityName?: string; // For renaming or destroying a city
  newCityName?: string; // For renaming or founding a city
  territoryForNewCity?: string; // Name of the territory for founding a new city
  newCityCoordinates?: [number, number]; // [lon, lat] for a new city
  // Fields for CHAT_INVITATION events
  chatInitiator?: string;
  chatParticipants?: string[];
}

export interface ChatMessage {
    sender: string; // Country name
    text: string;
}

export interface DiplomaticChat {
    id: string;
    participants: string[];
    messages: ChatMessage[];
    topic: string;
    currentSpeaker: string | null; // null means the AI is deciding who speaks next
}

export interface AdvisorSuggestion {
  suggestion: string;
  reasoning: string;
}

export enum GamePhase {
    LOADING,
    SELECTION,
    PLAYING
}

export interface MapData {
    [key: string]: any;
}