// src/app/chat/components/TaskBar.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

const WIN7_CSS_LINK_ID = 'win7-css-link';
const WINXP_CSS_LINK_ID = 'winxp-css-link';

export const TaskBar: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isWin7Mode, setIsWin7Mode] = useState(false);
  const [isWinXPMode, setIsWinXPMode] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Check theme mode
  const checkThemeMode = useCallback(() => {
    if (typeof window === 'undefined') return { isWin7: false, isWinXP: false };
    
    const win7Link = document.getElementById(WIN7_CSS_LINK_ID) as HTMLLinkElement;
    const winxpLink = document.getElementById(WINXP_CSS_LINK_ID) as HTMLLinkElement;
    
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    const hasWinXPCSS = winxpLink && winxpLink.href.includes('xp.css');
    
    return { 
      isWin7: hasWin7CSS, 
      isWinXP: hasWinXPCSS 
    };
  }, []);

  // Update time
  const updateTime = useCallback(() => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    setCurrentTime(timeString);
  }, []);

  // Theme detection effect
  useEffect(() => {
    if (!mounted) return;

    const updateThemeState = () => {
      const { isWin7, isWinXP } = checkThemeMode();
      setIsWin7Mode(isWin7);
      setIsWinXPMode(isWinXP);
    };

    updateThemeState();

    const headObserver = new MutationObserver((mutations) => {
      const linkMutation = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeName === 'LINK' || 
          (node as Element)?.id === WIN7_CSS_LINK_ID ||
          (node as Element)?.id === WINXP_CSS_LINK_ID
        ) ||
        Array.from(mutation.removedNodes).some(node => 
          node.nodeName === 'LINK' || 
          (node as Element)?.id === WIN7_CSS_LINK_ID ||
          (node as Element)?.id === WINXP_CSS_LINK_ID
        )
      );
      
      if (linkMutation) {
        updateThemeState();
      }
    });
    
    headObserver.observe(document.head, {
      childList: true,
      subtree: true
    });
    
    return () => {
      headObserver.disconnect();
    };
  }, [mounted, checkThemeMode]);

  // Time update effect
  useEffect(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [updateTime]);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Windows 98 TaskBar (based on your paste.txt)
  if (!isWin7Mode && !isWinXPMode) {
    return (
      <div className="taskbar" style={{ 
        zIndex: 5000,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        backgroundColor: '#c0c0c0',
        border: '2px outset #c0c0c0',
        display: 'flex',
        alignItems: 'center',
        padding: '2px'
      }}>
        {/* Start Button */}
        <button 
          className="start-button" 
          title="Click here to begin."
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            backgroundColor: '#c0c0c0',
            border: '1px outset #c0c0c0',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          <img 
            src="/images/start.png" 
            alt="Start" 
            style={{ width: '16px', height: '16px' }}
            onError={(e) => {
              // Fallback if start.png doesn't exist
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span>Start</span>
        </button>

        {/* Divider */}
        <div 
          className="taskbar-divider" 
          style={{
            width: '2px',
            height: '24px',
            backgroundColor: '#808080',
            margin: '0 4px',
            borderLeft: '1px solid #404040',
            borderRight: '1px solid #ffffff'
          }}
        />

        {/* Tasks area (empty but takes up space) */}
        <div 
          className="tasks" 
          style={{ 
            flex: 1,
            height: '24px',
            minWidth: '100px'
          }}
        />

        {/* Another divider */}
        <div 
          className="taskbar-divider" 
          style={{
            width: '2px',
            height: '24px',
            backgroundColor: '#808080',
            margin: '0 4px',
            borderLeft: '1px solid #404040',
            borderRight: '1px solid #ffffff'
          }}
        />

        {/* System Tray */}
        <div 
          className="tray inset-shallow" 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 4px',
            backgroundColor: '#c0c0c0',
            border: '1px inset #c0c0c0',
            minWidth: '80px'
          }}
        >
          {/* Tray icons container (empty but ready for future additions) */}
          <div className="tray-icons" style={{ display: 'flex', gap: '2px' }}>
            {/* Icons would go here - keeping empty as requested */}
          </div>
          
          {/* Time */}
          <div 
            className="taskbar-time" 
            style={{
              fontSize: '11px',
              padding: '2px 4px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title={`${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} at ${currentTime}`}
          >
            {currentTime}
          </div>
        </div>
      </div>
    );
  }

  // Windows 7 TaskBar (based on your paste.txt)
  if (isWin7Mode) {
    return (
      <div 
        id="taskbar" 
        className="glass active"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(10px)',
          border: 'none',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          zIndex: 5000
        }}
      >
        {/* Start Button - Windows 7 style */}
        <button
          style={{
            width: '52px',
            height: '32px',
            background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginRight: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(to bottom, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.2))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(to bottom, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))';
          }}
        >
          <img 
            src="/images/start.png" 
            alt="Start" 
            style={{ width: '20px', height: '20px' }}
            onError={(e) => {
              // Fallback - show Windows logo text
              (e.target as HTMLImageElement).outerHTML = '<span style="color: white; font-size: 12px; font-weight: bold;">⊞</span>';
            }}
          />
        </button>

        {/* Taskbar items area (empty) */}
        <div 
          id="taskbar-items" 
          style={{ 
            flex: 1,
            height: '32px',
            minWidth: '100px'
          }}
        />

        {/* System Tray */}
        <div 
          id="taskbar-tray"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            backdropFilter: 'blur(5px)',
            minWidth: '100px'
          }}
        >
          {/* Tray icons area (empty but ready) */}
          <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
            {/* Icons would go here */}
          </div>

          {/* Show Desktop Button */}
          <button 
            id="show-desktop"
            aria-label="Desktop"
            style={{
              width: '12px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          />

          {/* Time */}
          <div 
            style={{
              color: 'white',
              fontSize: '12px',
              fontWeight: '500',
              textAlign: 'center',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '3px',
              transition: 'background 0.2s ease',
              userSelect: 'none',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              minWidth: '65px'
            }}
            title={new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ fontSize: '11px', lineHeight: '1.2' }}>
              {currentTime}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Windows XP TaskBar (based on your paste.txt footer)
  if (isWinXPMode) {
    return (
      <footer 
        className="taskbar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '30px',
          background: 'linear-gradient(to bottom, #245edb, #1941a5)',
          border: 'none',
          borderTop: '1px solid #4272db',
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px',
          zIndex: 5000,
          boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Start Button - XP Style */}
        <button
          style={{
            height: '24px',
            padding: '0 12px 0 4px',
            background: 'linear-gradient(to bottom, #3375f0, #1941a5)',
            border: '1px outset #4272db',
            borderRadius: '8px 8px 8px 0',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            marginRight: '6px',
            fontFamily: 'Tahoma, sans-serif',
            textShadow: '1px 1px 1px rgba(0, 0, 0, 0.5)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(to bottom, #4080ff, #2050c0)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(to bottom, #3375f0, #1941a5)';
          }}
        >
          <img 
            src="/images/start.png" 
            alt="Start" 
            style={{ width: '16px', height: '16px' }}
            onError={(e) => {
              // Fallback for missing start icon
              (e.target as HTMLImageElement).outerHTML = '<span style="color: white; font-size: 12px;">⊞</span>';
            }}
          />
          <span>start</span>
        </button>

        {/* Task buttons area (empty) */}
        <div 
          className="footer__items left" 
          style={{ 
            flex: 1,
            height: '24px',
            minWidth: '100px'
          }}
        />

        {/* System Tray */}
        <div 
          className="footer__items right"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px inset #1941a5',
            borderRadius: '2px',
            padding: '2px 4px',
            minWidth: '80px'
          }}
        >
          {/* System tray icons area (empty but ready) */}
          <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
            {/* Icons would go here */}
          </div>

          {/* Time */}
          <div 
            style={{
              color: 'white',
              fontSize: '11px',
              fontFamily: 'Tahoma, sans-serif',
              textAlign: 'center',
              cursor: 'pointer',
              padding: '2px 4px',
              userSelect: 'none',
              textShadow: '1px 1px 1px rgba(0, 0, 0, 0.5)',
              minWidth: '50px'
            }}
            title={`${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} at ${currentTime}`}
          >
            {currentTime}
          </div>
        </div>
      </footer>
    );
  }

  return null;
};