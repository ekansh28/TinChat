// src/components/home/OnlineUsersWindow.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import '@/styles/onlineUsers.css';

interface OnlineUsersData {
  connectedUsers: string[]; // All authenticated users
  queueStats: {
    textQueue: number;
    videoQueue: number;
  };
  activeChats: number; // Number of people currently in chat rooms
  totalOnline: number; // Total connected (including anonymous)
}

interface OnlineUsersWindowProps {
  onlineUsersData: OnlineUsersData;
  isMobile: boolean;
}

export default function OnlineUsersWindow({ onlineUsersData, isMobile }: OnlineUsersWindowProps) {
  // Don't show on mobile to avoid cluttering
  if (isMobile) return null;

  const { connectedUsers, queueStats, activeChats, totalOnline } = onlineUsersData;

  return (
    <div 
      className={cn(
        "fixed top-1/2 left-4 transform -translate-y-1/2 z-10",
        "w-[250px] h-[220px]", // Slightly taller to accommodate stats
        "bg-black bg-opacity-60",
        "border border-white border-opacity-100",
        "rounded-lg",
        "flex flex-col",
        "pixelated-border"
      )}
      style={{
        imageRendering: 'pixelated',
        boxShadow: `
          0 0 0 1px white,
          1px 1px 0 1px white,
          -1px -1px 0 1px white,
          1px -1px 0 1px white,
          -1px 1px 0 1px white
        `
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 text-center py-2 border-b border-white border-opacity-30">
        <h3 
          className="text-green-600 font-bold text-sm tracking-wide"
          style={{ 
            textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
            fontFamily: 'monospace'
          }}
        >
          ONLINE NOW
        </h3>
      </div>

      {/* Stats Section */}
      <div className="flex-shrink-0 px-2 py-1 border-b border-white border-opacity-20">
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div 
            className="text-white text-center"
            style={{ 
              textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
              fontFamily: 'monospace'
            }}
          >
            <div>Total: {totalOnline}</div>
          </div>
          <div 
            className="text-white text-center"
            style={{ 
              textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
              fontFamily: 'monospace'
            }}
          >
            <div>Chatting: {activeChats}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs mt-1">
          <div 
            className="text-white text-center"
            style={{ 
              textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
              fontFamily: 'monospace'
            }}
          >
            <div>Text Q: {queueStats.textQueue}</div>
          </div>
          <div 
            className="text-white text-center"
            style={{ 
              textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
              fontFamily: 'monospace'
            }}
          >
            <div>Video Q: {queueStats.videoQueue}</div>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="flex-1 p-2 overflow-y-auto">
        {connectedUsers.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 text-xs">
            {connectedUsers.map((username, index) => (
              <div
                key={`${username}-${index}`}
                className={cn(
                  "text-red-500 font-medium truncate text-center",
                  "hover:text-red-400 transition-colors cursor-default",
                  "p-1 rounded-sm hover:bg-white hover:bg-opacity-10"
                )}
                style={{ 
                  textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
                  fontFamily: 'monospace'
                }}
                title={username} // Show full username on hover
              >
                {username}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p 
              className="text-gray-400 text-xs text-center"
              style={{ 
                textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
                fontFamily: 'monospace'
              }}
            >
              No users online
            </p>
          </div>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="flex-shrink-0 h-1"></div>
    </div>
  );
}