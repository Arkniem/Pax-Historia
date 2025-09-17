import React, { useState } from 'react';
import { Country, Territory, MapData } from '../types';
import WorldMap from './WorldMap';

interface CountrySelectionScreenProps {
  countries: { [name: string]: Country };
  territories: { [id: string]: Territory };
  mapData: MapData;
  onSelect: (countryName: string) => void;
}

const subdividedCountries = ['United States of America'];

export default function CountrySelectionScreen({ countries, territories, mapData, onSelect }: CountrySelectionScreenProps) {
    const [selection, setSelection] = useState<{ name: string; type: 'country' | 'territory' } | null>(null);

    const handleTerritoryClick = (territoryId: string) => {
        const territory = Object.values(territories).find(t => t.id === territoryId);
        if (!territory) return;

        const parentCountryName = territory.parentCountryName;
        // Prevent selection of territories that don't have a formal Country entity (e.g., Antarctica).
        if (!countries[parentCountryName]) {
            setSelection(null);
            return;
        }
        
        // If a subdividable country is already selected, and we click one of its states, select that state.
        if (selection && selection.type === 'country' && subdividedCountries.includes(selection.name) && selection.name === parentCountryName) {
            setSelection({ name: territory.name, type: 'territory' });
        } else {
            // Otherwise, just select the parent country.
            setSelection({ name: parentCountryName, type: 'country' });
        }
    }
  
    const selectedCountry = selection && selection.type === 'country' ? countries[selection.name] : null;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
            <div className="absolute top-0 left-0 right-0 p-4 text-center bg-gray-900 bg-opacity-80 z-10">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">AI World Simulator</h1>
                <p className="text-lg text-gray-400">Select Your Nation by Clicking on the Map</p>
            </div>
            
            <div className="w-full h-screen">
                <WorldMap 
                    territories={territories}
                    countries={countries}
                    mapData={mapData}
                    onTerritoryClick={handleTerritoryClick}
                    playerCountryName={null}
                    selectionMode={true}
                    selectedName={selection?.name}
                    selectionType={selection?.type}
                />
            </div>
    
            {selection && (
                 <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-900 to-transparent z-10 flex justify-center">
                    <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md flex items-center justify-between">
                        <div className="flex items-center">
                            {selectedCountry && <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: selectedCountry.color }}></div>}
                            <span className="font-bold text-lg">Selected: {selection.name}</span>
                        </div>
                        <button 
                          onClick={() => onSelect(selection.name)}
                          className="bg-primary hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
                        >
                          {selection.type === 'territory' ? 'Lead Secession' : 'Lead This Nation'}
                        </button>
                    </div>
                </div>
            )}
        </div>
      );
}
