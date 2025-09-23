import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Country, Territory, MapData, City, MilitaryUnit } from '../types';
import { feature } from 'topojson-client';
import { geoCentroid, geoArea, geoPath, geoMercator } from 'd3-geo';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';

interface WorldMapProps {
  territories: { [id: string]: Territory };
  countries: { [name: string]: Country };
  cities?: City[];
  militaryUnits?: { [id: string]: MilitaryUnit };
  selectedUnit?: MilitaryUnit | null;
  mapData: MapData;
  onTerritoryClick?: (territoryId: string) => void;
  onUnitClick?: (unitId: string) => void;
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

// --- Main Component ---
const WorldMap = ({
  territories,
  countries,
  cities = [],
  militaryUnits = {},
  selectedUnit = null,
  mapData,
  onTerritoryClick = () => {},
  onUnitClick = () => {},
  playerCountryName,
  selectionMode = false,
  selectedName = null,
  selectionType = 'country',
}: WorldMapProps) => {
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
    const [transform, setTransform] = useState(zoomIdentity);
    const svgRef = useRef<SVGSVGElement>(null);
    const [{ width, height }, setDimensions] = useState({ width: 0, height: 0 });
    const [worldWidth, setWorldWidth] = useState(0);
    
    // --- D3 Zoom & Pan Setup ---
    useEffect(() => {
        if (!svgRef.current || !width || !height) return;
        const svg = select(svgRef.current as SVGSVGElement);
        const zoomBehavior = zoom()
            .scaleExtent([1, 50]) // Min zoom is 1 (default), max is 50x.
            .on('zoom', (event) => {
                setTransform(event.transform);
            });
        svg.call(zoomBehavior);
    }, [width, height]);

    // --- Dynamic Resizing ---
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setDimensions({ width, height });
            }
        });
        if (svgRef.current?.parentElement) {
            resizeObserver.observe(svgRef.current.parentElement);
        }
        return () => resizeObserver.disconnect();
    }, []);

    // --- Projection Logic ---
    const projection = useMemo(() => {
        return geoMercator()
            .scale(width / 6)
            .center([0, 20])
            .translate([width / 2, height / 2]);
    }, [width, height]);

    const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

    const landGeo = useMemo(() => {
        if (mapData.world && mapData.world.objects.land) {
            return feature(mapData.world, mapData.world.objects.land as any);
        }
        return null;
    }, [mapData]);

    useEffect(() => {
        if (pathGenerator && landGeo && width > 0) {
            const [[x0], [x1]] = pathGenerator.bounds(landGeo);
            setWorldWidth(x1 - x0);
        }
    }, [pathGenerator, landGeo, width]);


    const allGeographies = useMemo(() => {
        const worldFeatures = (feature(mapData.world, mapData.world.objects.countries as any) as any).features;
        const usFeatures = (feature(mapData.us, mapData.us.objects.states as any) as any).features;
        return [
            ...worldFeatures.map(f => ({ geo: f, type: 'world' })),
            ...usFeatures.map(f => ({ geo: f, type: 'us' })),
        ];
    }, [mapData]);

    const getTerritoryId = (geo: any, type: string) => {
        switch (type) {
            case 'world': return geo.properties.name;
            case 'us': return `USA-${geo.id}`;
            default: return `${type.toUpperCase()}-${geo.properties.name}`;
        }
    };
    
    // --- Render Logic ---
    const renderTerritories = () => {
        return allGeographies
            .filter(({ geo, type }) => {
                // In selection mode, filter out world geographies that are subdivided
                if (selectionMode && type === 'world') {
                    return !subdividedCountries.includes(geo.properties.name);
                }
                return true;
            })
            .map(({ geo, type }) => {
                const territoryId = getTerritoryId(geo, type);
                const territory = territories[territoryId];
                if (!territory) return null;

                const parentCountryName = territory.parentCountryName;
                const owner = countries[territory.owner];
                const isClickable = owner && owner.name !== 'Unclaimed';

                // SELECTION MODE STYLES
                if (selectionMode) {
                    const isParentSelected = selectionType === 'country' && parentCountryName === selectedName;
                    const isThisTerritorySelected = selectionType === 'territory' && territory.name === selectedName;
                    const isSelectable = !!countries[parentCountryName];

                    const getFillColor = () => {
                        if (isThisTerritorySelected) return '#FBBF24'; // Gold for seceding state
                        if (isParentSelected) return '#3B82F6';
                        return countries[parentCountryName]?.color || '#374151';
                    };
                    const getStrokeColor = () => {
                        if (isThisTerritorySelected) return '#FDE68A';
                        if (isParentSelected) return '#E5E7EB';
                        return '#4B5563';
                    };
                    return (
                        <path
                            key={`${type}-${geo.rsmKey}`}
                            d={pathGenerator(geo) || ''}
                            fill={getFillColor()}
                            stroke={getStrokeColor()}
                            strokeWidth={isParentSelected || isThisTerritorySelected ? 0.7 / transform.k : 0.5 / transform.k}
                            onClick={() => onTerritoryClick(territoryId)}
                            className={isSelectable ? 'cursor-pointer' : 'cursor-not-allowed'}
                            style={{ opacity: isSelectable ? 1 : 0.5 }}
                        />
                    );
                }

                // GAMEPLAY MODE STYLES
                const fillColor = owner ? owner.color : '#374151';
                const defaultStrokeColor = owner && isColorBlueish(owner.color) ? '#9CA3AF' : '#111827';
                return (
                    <path
                        key={`${type}-${geo.rsmKey}`}
                        d={pathGenerator(geo) || ''}
                        fill={fillColor}
                        stroke={hoveredCountry === owner?.name ? '#FFFFFF' : defaultStrokeColor}
                        strokeWidth={hoveredCountry === owner?.name ? 1.2 / transform.k : 0.5 / transform.k}
                        className={isClickable ? 'cursor-pointer' : ''}
                        onClick={() => isClickable && onTerritoryClick(territoryId)}
                        onMouseEnter={() => owner && setHoveredCountry(owner.name)}
                        onMouseLeave={() => setHoveredCountry(null)}
                    />
                );
            });
    };
    
    // --- Gameplay Labels & Markers ---
    const allCountryLabelData = useMemo(() => {
      const featuresByTerritoryId: { [id: string]: any } = {};
      allGeographies.forEach(({geo, type}) => {
          const territoryId = getTerritoryId(geo, type);
          featuresByTerritoryId[territoryId] = geo;
      });

      return Object.values(countries)
          .map(country => {
              const countryTerritories = Object.values(territories).filter(t => t.owner === country.name);
              if (countryTerritories.length === 0) return null;

              let largestGeoArea = 0;
              let largestTerritoryGeo: any = null;

              if (country.labelCoordinates) {
                  // If custom coords are provided, just find the largest territory for area calculation.
                  countryTerritories.forEach(t => {
                      const feature = featuresByTerritoryId[t.id];
                      if (feature) {
                          const area = geoArea(feature);
                          if (area > largestGeoArea) {
                              largestGeoArea = area;
                              largestTerritoryGeo = feature;
                          }
                      }
                  });
              } else {
                  // Find the largest territory to place the centroid in.
                  countryTerritories.forEach(t => {
                      const feature = featuresByTerritoryId[t.id];
                      if (feature) {
                          const area = geoArea(feature);
                          if (area > largestGeoArea) {
                              largestGeoArea = area;
                              largestTerritoryGeo = feature;
                          }
                      }
                  });
              }
              
              if (!largestTerritoryGeo) return null;

              const centroid = country.labelCoordinates ? country.labelCoordinates : geoCentroid(largestTerritoryGeo);
              if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return null;
              
              const coords = projection(centroid as [number, number]);
              if (!coords) return null; // Don't render if off-screen

              // --- Dynamic Font Size Calculation ---
              const projectedArea = pathGenerator.area(largestTerritoryGeo);
              const displayName = country.labelName || country.name;

              // Heuristic to determine font size.
              // Proportional to sqrt of area (like a radius), inversely proportional to name length.
              const fontScale = 1.6; // Tuning parameter
              const minFontSize = 2.5;
              const maxFontSize = 18.0;

              let baseFontSize = (Math.sqrt(projectedArea) / displayName.length) * fontScale;
              
              // Give a boost to multi-word names so they don't get penalized too heavily by length.
              if (displayName.includes(' ')) {
                baseFontSize *= 1.4;
              }

              // Clamp the font size to reasonable limits.
              baseFontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));

              return { name: country.name, coords, baseFontSize };
          })
          .filter((c): c is { name: string; coords: [number, number]; baseFontSize: number; } => c !== null);

  }, [territories, countries, allGeographies, projection, pathGenerator]);


    const renderLabelsAndMarkers = () => {
        if (selectionMode) return null;

        const citiesToShow = (!hoveredCountry || transform.k < 1.5) ? [] : cities.filter(city => {
            const territory = territories[city.territoryId];
            return territory && territory.owner === hoveredCountry;
        });

        return (
            <>
                {/* COUNTRY LABELS */}
                {allCountryLabelData.map(({ name, coords, baseFontSize }) => {
                    const country = countries[name];
                    if (!country) return null;
                    
                    const finalSize = baseFontSize / Math.sqrt(transform.k);

                    // Hide labels that become too small, especially when slightly zoomed in.
                    if (finalSize < 2.0 && transform.k > 1.1) return null;

                    return (
                        <text
                            key={`label-${name}`}
                            x={coords[0]}
                            y={coords[1]}
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            stroke="#111827"
                            strokeWidth={0.4 / transform.k}
                            strokeLinejoin="round"
                            className="pointer-events-none font-semibold"
                            style={{ fill: "#FFFFFF", fontSize: `${finalSize}px`, fontFamily: "Inter, system-ui, sans-serif" }}
                        >
                            {country.labelName || name}
                        </text>
                    );
                })}

                {/* CITY MARKERS */}
                {citiesToShow.map(city => {
                    const territory = territories[city.territoryId];
                    if (!territory) return null;
                    const owner = countries[territory.owner];
                    const ownerColor = owner ? owner.color : '#9CA3AF';
                    const coords = projection(city.coordinates);
                    if (!coords) return null;

                    return (
                         <g key={city.id} transform={`translate(${coords[0]}, ${coords[1]}) scale(${1 / transform.k})`}>
                            {city.isCapital ? (
                                <path d="M0 -4 L1.5 -1.2 L4.5 -1.2 L2.5 0.5 L3.2 3.5 L0 2 L-3.2 3.5 L-2.5 0.5 L-4.5 -1.2 L-1.5 -1.2 Z" fill={ownerColor} stroke="#FFFFFF" strokeWidth={0.75} />
                            ) : (
                                <rect x="-2" y="-2" width="4" height="4" fill={ownerColor} stroke="#FFFFFF" strokeWidth={0.75} />
                            )}
                            <text textAnchor="middle" y={-8} stroke="#1F2937" strokeWidth="0.2" strokeLinejoin="round" className="pointer-events-none font-semibold" style={{ fontFamily: "Inter, system-ui, sans-serif", fill: "#FFFFFF", fontSize: 9 }}>
                                {city.name}
                            </text>
                        </g>
                    );
                })}
                
                {/* UNIT MARKERS */}
                {Object.values(militaryUnits).map(unit => {
                     const coords = projection(unit.coordinates);
                     if (!coords) return null;

                     const owner = countries[unit.owner];
                     const ownerColor = owner ? owner.color : '#9CA3AF';
                     const iconSize = 4 / Math.sqrt(transform.k);
                     const isSelected = selectedUnit?.id === unit.id;

                     return (
                        <g key={unit.id} transform={`translate(${coords[0]}, ${coords[1]})`}
                           onClick={() => onUnitClick(unit.id)}
                           className="cursor-pointer"
                           onMouseEnter={() => setHoveredCountry(unit.owner)}
                           onMouseLeave={() => setHoveredCountry(null)}
                        >
                            <circle 
                                r={isSelected ? iconSize * 1.5 : iconSize}
                                fill={ownerColor}
                                stroke={isSelected ? "#FBBF24" : "#FFFFFF"}
                                strokeWidth={(isSelected ? 1.5 : 0.75) / transform.k}
                                className="transition-all duration-200"
                            />
                             <text
                                textAnchor="middle"
                                y={iconSize * -1.5}
                                stroke="#1F2937"
                                strokeWidth={0.2 / transform.k}
                                strokeLinejoin="round"
                                className="pointer-events-none font-semibold"
                                style={{
                                    fontFamily: "Inter, system-ui, sans-serif",
                                    fill: "#FFFFFF",
                                    fontSize: `${6 / transform.k}px`,
                                }}
                            >
                               {transform.k > 2 ? unit.name : ""}
                            </text>
                        </g>
                     );
                })}
            </>
        );
    }
    
    return (
        <div className="w-full h-full bg-sky-800">
            <svg ref={svgRef} width="100%" height="100%">
                <g transform={transform.toString()}>
                    {worldWidth > 0 ? (
                        [-1, 0, 1].map(i => (
                            <g key={i} transform={`translate(${i * worldWidth}, 0)`}>
                                {renderTerritories()}
                                {renderLabelsAndMarkers()}
                            </g>
                        ))
                    ) : (
                        <>
                            {renderTerritories()}
                            {renderLabelsAndMarkers()}
                        </>
                    )}
                </g>
            </svg>
        </div>
    );
};

export default memo(WorldMap);