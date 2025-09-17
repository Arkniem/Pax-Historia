
import React, { useState } from 'react';

interface ActionPanelProps {
  onSimulate: (action: string) => void;
  isSimulating: boolean;
}

export default function ActionPanel({ onSimulate, isSimulating }: ActionPanelProps) {
  const [action, setAction] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action.trim() && !isSimulating) {
      onSimulate(action);
      setAction('');
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md">
      <h2 className="text-lg font-bold text-white mb-3">National Action</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          className="w-full h-24 p-2 bg-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="e.g., Invest in new technologies, seek an alliance with France..."
          value={action}
          onChange={(e) => setAction(e.target.value)}
          disabled={isSimulating}
        />
        <button
          type="submit"
          disabled={isSimulating || !action.trim()}
          className="w-full mt-3 bg-primary hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-wait text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out flex items-center justify-center"
        >
          {isSimulating ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Simulating...
            </>
          ) : (
            'Submit Action'
          )}
        </button>
      </form>
    </div>
  );
}