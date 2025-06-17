// src/app/chat/components/LoadingScreen.tsx
import React from 'react';

interface LoadingScreenProps {
  auth: {
    isLoading: boolean;
  };
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ auth }) => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
      <p className="mt-4 text-gray-600">
        {auth.isLoading ? 'Loading authentication...' : 'Loading chat...'}
      </p>
    </div>
  </div>
);

