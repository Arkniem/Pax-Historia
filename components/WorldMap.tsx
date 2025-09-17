
import React, { memo, useMemo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps';
import { Country, Territory, MapData, City } from '../types';
import { feature } from 'topojson-client';
import { geoCentroid, geoArea } from 'd3-geo';


interface WorldMapProps {
  territories: { [id: string]: Territory };
  countries: { [name: string]: Country };
  cities?: City[];
  mapData: MapData;
  onTerritoryClick?: (territoryId: string) => void;
  playerCountryName: string | null;
  selectionMode?: boolean;
  selectedName?: string | null;
  selectionType?: 'country' | 'territory';
}

const subdividedCountries = ['United States of America'];

// --- Helper Functions ---
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const isColorBlueish = (hexColor: string): boolean => {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return false;
    // Check if blue is the dominant color and it's not too dark/gray
    return rgb.b > rgb.r && rgb.b > rgb.g && rgb.b > 80;
};

const WorldMap = ({
  territories,
  countries,
  cities = [],
  mapData,
  onTerritoryClick = () => {},
  playerCountryName,
  selectionMode = false,
  selectedName = null,
  selectionType = 'country',
}: WorldMapProps) => {
    const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

    const handleMoveEnd = (pos: { coordinates: [number, number]; zoom: number }) => {
        setPosition(pos);
    };

    const getTerritoryId = (geo: any, type: string) => {
        switch(type) {
        case 'world': return geo.properties.name;
        case 'us': return `USA-${geo.id}`;
        default: return `${type.toUpperCase()}-${geo.properties.name}`;
        }
    };
    
    // SELECTION MODE RENDERER
    const renderSelectionGeographies = () => (
        <>
            <Geographies geography={mapData.world}>
                {({ geographies }) => geographies
                    .filter(geo => !subdividedCountries.includes(geo.properties.name))
                    .map((geo) => {
                        const territoryId = getTerritoryId(geo, 'world');
                        const territory = territories[territoryId];
                        if (!territory) return null;

                        const parentCountryName = territory.parentCountryName;
                        const isSelected = selectionType === 'country' && parentCountryName === selectedName;
                        const isSelectable = !!countries[parentCountryName];
                        const defaultColor = countries[parentCountryName]?.color || '#374151';
                        
                        return (
                            <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                onClick={() => onTerritoryClick(territoryId)}
                                style={{
                                    default: { fill: isSelected ? '#3B82F6' : defaultColor, stroke: '#111827', strokeWidth: 0.5, outline: 'none', opacity: isSelectable ? 1 : 0.5 },
                                    hover: { fill: !isSelectable ? defaultColor : '#60A5FA', stroke: '#E5E7EB', strokeWidth: 1, outline: 'none', cursor: isSelectable ? 'pointer' : 'not-allowed'},
                                    pressed: { fill: !isSelectable ? defaultColor : '#2563EB', outline: 'none' },
                                }}
                            />
                        );
                })}
            </Geographies>
            <Geographies geography={mapData.us}>
                {({ geographies }) => geographies.map(geo => {
                    const territoryId = getTerritoryId(geo, 'us');
                    const territory = territories[territoryId];
                    if (!territory) return null;

                    const parentCountryName = territory.parentCountryName;
                    const isParentSelected = selectionType === 'country' && parentCountryName === selectedName;
                    const isThisTerritorySelected = selectionType === 'territory' && territory.name === selectedName;

                    const getFillColor = () => {
                        if (isThisTerritorySelected) return '#FBBF24'; // Gold for seceding state
                        if (isParentSelected) return '#3B82F6';
                        return countries[parentCountryName]?.color || '#374151';
                    };
                    
                    const getStrokeColor = () => {
                        if (isThisTerritorySelected) return '#FDE68A';
                        if (isParentSelected) return '#E5E7EB';
                        return '#4B5563';
                    }

                    return (
                        <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => onTerritoryClick(territory.id)}
                            style={{
                                default: { fill: getFillColor(), stroke: getStrokeColor(), strokeWidth: (isParentSelected || isThisTerritorySelected) ? 0.7 : 0.5, outline: 'none' },
                                hover: { fill: '#60A5FA', stroke: '#E5E7EB', strokeWidth: 1, outline: 'none', cursor: 'pointer' },
                                pressed: { fill: '#2563EB', outline: 'none' },
                            }}
                        />
                    );
                })}
            </Geographies>
        </>
    );

    if (selectionMode) {
        return (
            <div className="w-full h-full bg-sky-800">
                <ComposableMap projectionConfig={{ scale: 180 }} style={{ width: '100%', height: '100%' }}>
                    <ZoomableGroup center={[0, 20]} zoom={1} onMoveEnd={handleMoveEnd}>
                        {renderSelectionGeographies()}
                    </ZoomableGroup>
                </ComposableMap>
            </div>
        );
    }
    
    // --- GAMEPLAY MODE OPTIMIZATIONS ---
    const allCountryLabelData = useMemo(() => {
        const worldFeatures = (feature(mapData.world, mapData.world.objects.countries as any) as any).features;
        const usFeatures = (feature(mapData.us, mapData.us.objects.states as any) as any).features;

        const allFeatures = [
            ...worldFeatures.map(f => ({...f, featureType: 'world'})),
            ...usFeatures.map(f => ({...f, featureType: 'us'})),
        ];

        const featuresByTerritoryId: { [id: string]: any } = {};
        allFeatures.forEach(f => {
            const territoryId = getTerritoryId(f, f.featureType);
            featuresByTerritoryId[territoryId] = f;
        });

        return Object.values(countries)
            .map(country => {
                const countryTerritories = Object.values(territories).filter(t => t.owner === country.name);
                if (countryTerritories.length === 0) return null;

                let largestArea = 0;
                let centroid: [number, number] = [0, 0];

                countryTerritories.forEach(t => {
                    const feature = featuresByTerritoryId[t.id];
                    if (feature) {
                        const area = geoArea(feature);
                        if (area > largestArea) {
                            largestArea = area;
                            centroid = geoCentroid(feature);
                        }
                    }
                });
                
                if (largestArea === 0 || isNaN(centroid[0])) return null;

                return { name: country.name, largestArea, centroid };
            })
            .filter((c): c is { name: string; largestArea: number; centroid: [number, number] } => c !== null);

    }, [territories, countries, mapData]);

    const citiesToShow = useMemo(() => {
        if (!hoveredCountry || position.zoom < 1.5) return [];
        return cities.filter(city => {
            const territory = territories[city.territoryId];
            return territory && territory.owner === hoveredCountry;
        });
    }, [hoveredCountry, territories, position.zoom, cities]);

    const renderFillGeography = (geo: any, type: 'world' | 'us') => {
        const territoryId = getTerritoryId(geo, type);
        const territory = territories[territoryId];

        if (!territory) return null;

        const owner = countries[territory.owner];
        const fillColor = owner ? owner.color : '#374151';
        
        const defaultStrokeColor = owner && isColorBlueish(owner.color) ? '#9CA3AF' : '#111827';
        const isClickable = owner && owner.name !== 'Unclaimed';
        
        return (
            <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => isClickable && onTerritoryClick(territoryId)}
                onMouseEnter={() => owner && setHoveredCountry(owner.name)}
                onMouseLeave={() => setHoveredCountry(null)}
                style={{
                    default: { 
                        fill: fillColor, 
                        stroke: defaultStrokeColor, 
                        strokeWidth: 0.5 / position.zoom, 
                        outline: 'none', 
                        transition: 'stroke 0.2s, strokeWidth 0.2s, fill 0.2s' 
                    },
                    hover: { 
                        fill: fillColor, 
                        outline: 'none', 
                        cursor: isClickable ? 'pointer' : 'default', 
                        stroke: '#FFFFFF', 
                        strokeWidth: 1.2 / position.zoom 
                    },
                    pressed: { 
                        fill: fillColor, 
                        outline: 'none' 
                    },
                }}
            />
        );
    };
    
    const renderGameplayGeographies = () => (
      <>
        {/* FILLS */}
        <Geographies geography={mapData.world}>
            {({ geographies }) =>
                geographies
                    .filter(geo => !subdividedCountries.includes(geo.properties.name))
                    .map(geo => renderFillGeography(geo, 'world'))
            }
        </Geographies>
        <Geographies geography={mapData.us}>
            {({ geographies }) => geographies.map(geo => renderFillGeography(geo, 'us'))}
        </Geographies>
        
        {/* COUNTRY LABELS */}
        {allCountryLabelData.map(({ name, centroid, largestArea }) => {
            const country = countries[name];
            if (!country) return null;

            const baseFontSize = 4;
            const areaBonus = Math.log(largestArea + 1) * 2;
            let finalSize = (baseFontSize + areaBonus) / position.zoom;
            finalSize = finalSize * (country.labelSizeModifier || 1);

            if (finalSize < 2.5 && position.zoom > 1.2) return null;

            return (
                <Marker key={`label-${name}`} coordinates={country.labelCoordinates || centroid}>
                    <text
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        stroke="#111827"
                        strokeWidth={0.4 / position.zoom}
                        strokeLinejoin="round"
                        style={{
                            fontFamily: "Inter, system-ui, sans-serif",
                            fill: "#FFFFFF",
                            fontSize: `${finalSize}px`,
                            fontWeight: "600",
                            pointerEvents: "none",
                        }}
                    >
                        {country.labelName || name}
                    </text>
                </Marker>
            );
        })}

        {/* CITY LABELS (On Hover) */}
        {citiesToShow.map(city => {
            const territory = territories[city.territoryId];
            if (!territory) return null;
            const owner = countries[territory.owner];
            const ownerColor = owner ? owner.color : '#9CA3AF';

            return (
                <Marker key={city.id} coordinates={city.coordinates as [number, number]}>
                    <g transform={`scale(${1 / position.zoom})`}>
                        {city.isCapital ? (
                             <path d="M0 -4 L1.5 -1.2 L4.5 -1.2 L2.5 0.5 L3.2 3.5 L0 2 L-3.2 3.5 L-2.5 0.5 L-4.5 -1.2 L-1.5 -1.2 Z" fill={ownerColor} stroke="#FFFFFF" strokeWidth={0.75} />
                        ) : (
                            <rect x="-2" y="-2" width="4" height="4" fill={ownerColor} stroke="#FFFFFF" strokeWidth={0.75} />
                        )}
                        <text
                            textAnchor="middle"
                            y={-8}
                            stroke="#1F2937"
                            strokeWidth="0.2"
                            strokeLinejoin="round"
                            style={{ 
                                fontFamily: "Inter, system-ui, sans-serif", 
                                fill: "#FFFFFF", 
                                fontSize: 9, 
                                fontWeight: '600', 
                                pointerEvents: 'none',
                            }}
                        >
                            {city.name}
                        </text>
                    </g>
                </Marker>
            );
        })}
      </>
    );

    return (
        <div className="w-full h-full bg-sky-800">
            <ComposableMap projectionConfig={{ scale: 180 }} style={{ width: '100%', height: '100%' }}>
                <ZoomableGroup 
                    center={position.coordinates} 
                    zoom={position.zoom} 
                    onMoveEnd={handleMoveEnd}
                    maxZoom={50}
                >
                    {renderGameplayGeographies()}
                </ZoomableGroup>
            </ComposableMap>
        </div>
    );
};

export default memo(WorldMap);
