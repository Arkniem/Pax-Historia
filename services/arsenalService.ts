import { GameState, UnitType } from '../types';

/**
 * Checks if a country can deploy a new unit of a specific type based on arsenal limits.
 */
export function canDeployUnit(countryName: string, unitType: UnitType, gameState: GameState): boolean {
  const countryArsenal = gameState.arsenal[countryName];
  if (!countryArsenal) {
      // Fallback for safety, though every country should have an arsenal.
      return true; 
  }

  const maxUnits = countryArsenal[unitType].maxUnits;

  const currentUnitCount = Object.values(gameState.militaryUnits).filter(
    unit => unit.owner === countryName && unit.type === unitType
  ).length;

  return currentUnitCount < maxUnits;
}

/**
 * Gets the next available specific unit name from the arsenal list, if available.
 * Returns null if no specific names are defined or if all are already deployed.
 */
export function getNextAvailableUnitName(countryName: string, unitType: UnitType, gameState: GameState): string | null {
    const unitNames = gameState.arsenal[countryName]?.[unitType]?.unitNames;
    if (!unitNames || unitNames.length === 0) {
        return null;
    }

    const deployedUnitNames = new Set(
        Object.values(gameState.militaryUnits)
            .filter(unit => unit.owner === countryName && unit.type === unitType)
            .map(unit => unit.name)
    );

    return unitNames.find(name => !deployedUnitNames.has(name)) || null;
}