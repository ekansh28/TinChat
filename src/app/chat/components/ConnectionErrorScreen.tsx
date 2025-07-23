// src/app/chat/components/ConnectionErrorScreen.tsx
import React from 'react';

interface ConnectionErrorScreenProps {
  error: string | null;
  onRetry: () => void;
}

export const ConnectionErrorScreen: React.FC<ConnectionErrorScreenProps> = ({ error, onRetry }) => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold mb-2">Connection Error</h2>
      <p className="text-gray-600 mb-4">{error}</p>
      
      <button 
        onClick={onRetry}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Reload Page
      </button>
    </div>
  </div>
);
