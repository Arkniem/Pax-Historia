
import React, { useState } from 'react';

interface AdvisorPanelProps {
    onAskAdvice: (question: string) => void;
    isAdvising: boolean;
    advice: string | null;
}

export default function AdvisorPanel({ onAskAdvice, isAdvising, advice }: AdvisorPanelProps) {
    const [question, setQuestion] = useState('What should be our nation\'s primary focus right now?');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (question.trim() && !isAdvising) {
            onAskAdvice(question);
        }
    };
    
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-md mt-4">
            <h2 className="text-lg font-bold text-white mb-3">Strategic Advisor</h2>
            <form onSubmit={handleSubmit}>
                <textarea
                  className="w-full h-20 p-2 bg-gray-700 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Ask your advisor for strategic guidance..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={isAdvising}
                />
                <button
                    type="submit"
                    disabled={isAdvising || !question.trim()}
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-wait text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out flex items-center justify-center"
                >
                    {isAdvising ? (
                         <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Thinking...
                        </>
                    ) : 'Ask for Advice'}
                </button>
            </form>
            {advice && (
                <div className="mt-4 p-3 bg-gray-700 rounded-lg max-h-48 overflow-y-auto">
                    <h3 className="font-semibold text-indigo-300">Advisor's Counsel:</h3>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{advice}</p>
                </div>
            )}
        </div>
    );
}
