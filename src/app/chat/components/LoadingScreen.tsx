// src/app/chat/components/LoadingScreen.tsx
import React from 'react';

interface LoadingScreenProps {
  auth: {
    isLoading: boolean;
  };
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ auth }) => (
  <div className="flex items-center justify-center h-screen">
    <div
      className="text-center w-full max-w-md relative"
      style={{ height: '8rem' }} // Container for cat
    >
      <style>{`
        @keyframes leftRight {
          0% {
            left: 40%;
            transform: translateY(-50%) scaleX(1);
          }
          49.999% {
            left: calc(80% - 8rem);
            transform: translateY(-50%) scaleX(1);
          }
          50% {
            left: calc(80% - 8rem);
            transform: translateY(-50%) scaleX(-1);
          }
          100% {
            left: 40%;
            transform: translateY(-50%) scaleX(-1);
          }
        }
        .moving-cat {
          animation-name: leftRight;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-duration: 10s;
          position: absolute;
          top: 50%;
          width: 8rem;
          height: auto;
        }
      `}</style>

      <img
        src="https://cdn.tinchat.online/animations/loadingcat.gif"
        alt="Loading Cat"
        className="moving-cat"
      />

      <p className="mt-4 text-gray-600 relative z-10">
        {auth.isLoading ? 'Loading authentication...' : 'Loading chat...'}
      </p>
    </div>
  </div>
);
