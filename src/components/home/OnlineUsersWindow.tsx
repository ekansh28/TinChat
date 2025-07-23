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
    <>
      {/* Import 98.css */}
      <link rel="stylesheet" href="https://unpkg.com/98.css" />
      
      <div 
        className="window pixelated-border bg-black"
        style={{ 
            position: 'absolute',
            top: '50vh',
            left: '10%',
            transform: 'translateY(-50%)',
          zIndex: 9999, // Increased z-index
          width: '250px',
          backgroundColor: '#000000',
          borderTopColor: '#00ff00',
          borderRightColor: '#00ff00', 
          borderBottomColor: '#00ff00',
          borderLeftColor: '#00ff00',
          borderRadius: '8px',
          boxShadow: 'inset -1px -1px rgb(22, 22, 22), inset 1px 1px rgb(42, 43, 42), inset -2px -2px rgb(13, 13, 14), inset 2px 2px rgb(31, 31, 30)',
          // Add these to ensure it stays fixed
          willChange: 'transform',
          pointerEvents: 'auto',
          isolation: 'isolate'
        }}
      >

        <div 
          className="title-bar" 
          style={{ 
            backgroundColor: '#000000',
            background: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            borderTopColor: '#00ff00',
            borderRightColor: '#00ff00', 
            borderBottomColor: '#00ff00',
            borderLeftColor: '#00ff00',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px'
          }}
        >
          <div 
            style={{ 
              color: 'rgba(150, 10, 10, 0.8)',
              textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
              fontSize: '11px',
              fontWeight: 'normal',
              margin: '0 auto'
            }}
          >
            ONLINE USERS
          </div>
        </div>

        {/* Window Body */}
        <div 
          className="window-body" 
          style={{ 
            padding: '8px',
            backgroundColor: '#000000',
            borderTopColor: '#00ff00',
            borderRightColor: '#00ff00', 
            borderBottomColor: '#00ff00',
            borderLeftColor: '#00ff00',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px'
          }}
        >
          {/* Users List using TreeView style */}
          <div 
            className="sunken-panel overflow-y-auto" 
            style={{ 
              height: '120px', 
              padding: '4px',
              backgroundColor: '#000000',
              borderTopColor: '#00ff00',
              borderRightColor: '#00ff00', 
              borderBottomColor: '#00ff00',
              borderLeftColor: '#00ff00',
              borderRadius: '4px'
            }}
          >
            {connectedUsers.length > 0 ? (
              <ul 
                className="tree-view"
                style={{ 
                  backgroundColor: '#000000'
                }}
              >
                {connectedUsers.map((username, index) => (
                  <li 
                    key={`${username}-${index}`}
                    style={{ 
                      color: '#8f8f8f',
                      textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
                      cursor: 'default',
                      padding: '1px 0'
                    }}
                    className="hover:bg-green-900 hover:bg-opacity-30"
                  >
                    {username}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: '#8f8f8f',
                textShadow: '1px 1px 0 rgba(0,0,0,0.8)'
              }}>
                No users online
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}