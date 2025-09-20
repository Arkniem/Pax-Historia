import React, { useState } from 'react';
import { GameState, UnitType } from '../types';

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (locationDescription: string, deploymentBrief: string) => void;
  gameState: GameState;
  isDeploying: boolean;
}

export default function DeploymentModal({ isOpen, onClose, onDeploy, gameState, isDeploying }: DeploymentModalProps) {
  const [locationDescription, setLocationDescription] = useState<string>('');
  const [deploymentBrief, setDeploymentBrief] = useState<string>('');

  if (!isOpen) return null;

  const handleDeploy = () => {
    if (locationDescription.trim() && deploymentBrief.trim() && !isDeploying) {
      onDeploy(locationDescription, deploymentBrief);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
        <header className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Deploy Military Unit(s)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
        </header>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="brief" className="block text-sm font-medium text-gray-400 mb-2">Deployment Brief</label>
            <textarea
                id="brief"
                value={deploymentBrief}
                onChange={(e) => setDeploymentBrief(e.target.value)}
                className="w-full h-24 p-2 bg-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Describe the unit(s) to deploy. E.g., 'Deploy two armored divisions and one carrier strike group' or 'A small reconnaissance fleet.'"
            />
            <p className="text-xs text-gray-500 mt-1">The AI will interpret this brief to create and deploy one or more units.</p>
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-400 mb-2">Deployment Location</label>
            <textarea
              id="location"
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              className="w-full h-24 p-2 bg-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Describe the location, e.g., 'Off the coast of Japan' or 'The Black Forest, Germany'"
            />
             <p className="text-xs text-gray-500 mt-1">Be descriptive. The AI will place your unit(s) based on this text.</p>
          </div>
          <button
            onClick={handleDeploy}
            disabled={!locationDescription.trim() || !deploymentBrief.trim() || isDeploying}
            className="w-full mt-3 bg-primary hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-wait text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out flex items-center justify-center"
          >
            {isDeploying ? 'Deploying...' : 'Deploy Forces'}
          </button>
        </div>
      </div>
    </div>
  );
}