// src/app/chat/components/TaskBar.tsx - COMPLETELY FIXED VERSION

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FriendsWindow } from './FriendsWindow';
import { useAuth } from '../hooks/useAuth';
import AuthModal from '../../../components/AuthModal';

const WIN7_CSS_LINK_ID = 'win7-css-link';
const WINXP_CSS_LINK_ID = 'winxp-css-link';



// ✅ FIXED: Audio context for message sounds with proper typing
interface AudioManager {
  playMessageReceived: () => void;
  playMessageSent: () => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
}

// ✅ FIXED: Create audio manager with proper error handling
const createAudioManager = (): AudioManager => {
  const audioCache = new Map<string, HTMLAudioElement>();
  let currentVolume = 0.5; // Default 50% volume (taskbar level 2)

  const getAudio = (src: string): HTMLAudioElement => {
    if (!audioCache.has(src)) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audioCache.set(src, audio);
    }
    return audioCache.get(src)!;
  };

  const playSound = (src: string) => {
    try {
      const audio = getAudio(src);
      audio.volume = currentVolume;
      audio.currentTime = 0; // Reset to start
      audio.play().catch(err => {
        console.warn('[AudioManager] Failed to play sound:', err);
      });
    } catch (err) {
      console.warn('[AudioManager] Error playing sound:', err);
    }
  };

  return {
    playMessageReceived: () => playSound('/sounds/message/imrcv.wav'),
    playMessageSent: () => playSound('/sounds/message/imsend.mp3'),
    setVolume: (volume: number) => {
      // Convert taskbar level (0-3) to audio volume (0-1)
      currentVolume = volume === 0 ? 0 : volume / 3;
    },
    getVolume: () => {
      // Convert audio volume (0-1) to taskbar level (0-3)
      return currentVolume === 0 ? 0 : Math.round(currentVolume * 3);
    }
  };
};

// ✅ FIXED: Global audio manager instance with proper initialization
let globalAudioManager: AudioManager | null = null;

// ✅ FIXED: Export function to get audio manager
export const getAudioManager = (): AudioManager => {
  if (!globalAudioManager) {
    globalAudioManager = createAudioManager();
  }
  return globalAudioManager;
};

export const TaskBar: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isWin7Mode, setIsWin7Mode] = useState(false);
  const [isWinXPMode, setIsWinXPMode] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [audioVolume, setAudioVolume] = useState(2); // Range: 0-3 for all themes
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showFriendsWindow, setShowFriendsWindow] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const auth = useAuth(); // Auth state (do not remove existing)

  // ✅ FIXED: Mobile detection with proper cleanup
  const checkIfMobile = useCallback(() => {
    if (typeof window !== 'undefined') {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    }
  }, []);

  // ✅ FIXED: Mobile detection effect
  useEffect(() => {
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, [checkIfMobile]);

  // ✅ FIXED: Initialize audio manager and sync volume
  useEffect(() => {
    if (mounted) {
      const audioManager = getAudioManager();
      audioManager.setVolume(audioVolume);
    }
  }, [mounted, audioVolume]);

  // ✅ FIXED: Check theme mode with proper typing
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

  // ✅ FIXED: Update time with proper formatting
  const updateTime = useCallback(() => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    setCurrentTime(timeString);
  }, []);

  // ✅ FIXED: Get audio icon based on theme and volume
  const getAudioIcon = useCallback(() => {
    if (isWin7Mode) {
      // Windows 7: 0.ico (muted), 1.ico-3.ico (volume levels)
      if (audioVolume === 0) return '/icons/Taskbar/7/0.ico';
      if (audioVolume === 1) return '/icons/Taskbar/7/1.ico';
      if (audioVolume === 2) return '/icons/Taskbar/7/2.ico';
      return '/icons/Taskbar/7/3.ico'; // audioVolume === 3
    } else if (isWinXPMode) {
      // Windows XP: XP.png (unmuted), XPMute.png (muted)
      return audioVolume === 0 ? '/icons/Taskbar/XP/XPMute.png' : '/icons/Taskbar/XP/XP.png';
    } else {
      // Windows 98: 98.png (unmuted), 98Mute.png (muted)
      return audioVolume === 0 ? '/icons/Taskbar/98/98Mute.png' : '/icons/Taskbar/98/98.png';
    }
  }, [isWin7Mode, isWinXPMode, audioVolume]);

  // ✅ FIXED: Get friends icon based on theme
  const getFriendsIcon = useCallback(() => {
    if (isWin7Mode) {
      return '/icons/Taskbar/7/friends.ico';
    } else if (isWinXPMode) {
      return '/icons/Taskbar/XP/friends.png';
    } else {
      return '/icons/Taskbar/98/friends.png';
    }
  }, [isWin7Mode, isWinXPMode]);

  // ✅ FIXED: Handle volume change with audio manager sync and user interaction
  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(event.target.value);
    setAudioVolume(newVolume);
    
    // ✅ Sync with audio manager
    if (mounted) {
      const audioManager = getAudioManager();
      audioManager.setVolume(newVolume);
      
      // ✅ Play test sound when volume changed
      if (newVolume > 0) {
        setTimeout(() => {
          audioManager.playMessageReceived();
        }, 100);
      }
    }
  }, [mounted]);

  // ✅ FIXED: Handle audio icon click
  const handleAudioIconClick = useCallback(() => {
    setShowVolumeSlider(prev => !prev);
  }, [])
  
const handleAuthModalClose = (success?: boolean) => {
  setShowAuthModal(false);
  if (success) {
    setShowFriendsWindow(true);
  }
};

  // ✅ FIXED: Handle friends icon click
  const handleFriendsIconClick = useCallback(() => {
  if (auth.authId) {
    setShowFriendsWindow((v) => !v);
  } else {
    setShowAuthModal(true);
  }
}, [auth.authId]);


  // ✅ FIXED: Close volume slider when clicking outside
  useEffect(() => {
    if (!showVolumeSlider) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.volume-control-container')) {
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumeSlider]);

  // ✅ FIXED: Theme detection effect
  useEffect(() => {
    if (!mounted) return;

    const updateThemeState = () => {
      const { isWin7, isWinXP } = checkThemeMode();
      setIsWin7Mode(isWin7);
      setIsWinXPMode(isWinXP);
      
      // Adjust volume range when theme changes (all themes now use 0-3)
      setAudioVolume(prev => Math.min(prev, 3));
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

  // ✅ FIXED: Time update effect
  useEffect(() => {
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [updateTime]);

  // ✅ FIXED: Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ FIXED: Early return if not mounted
  if (!mounted) {
    return null;
  }

  // ✅ FIXED: Hide TaskBar on mobile devices
  if (isMobile) {
    return null;
  }

  // ✅ FIXED: Windows 98 TaskBar
  if (!isWin7Mode && !isWinXPMode) {
    return (
      <>
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

          {/* Tasks area */}
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
              minWidth: '160px',
              position: 'relative'
            }}
          >
            {/* Friends Control */}
            <img 
              src={getFriendsIcon()}
              alt="Friends"
              style={{ 
                width: '16px', 
                height: '16px', 
                cursor: 'pointer',
                marginRight: '4px'
              }}
              onClick={handleFriendsIconClick}
              title="Friends"
            />

            {/* Audio Control */}
            <div className="volume-control-container" style={{ position: 'relative' }}>
              <img 
                src={getAudioIcon()}
                alt="Volume"
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  cursor: 'pointer',
                  marginRight: '4px'
                }}
                onClick={handleAudioIconClick}
                title={`Message Volume: ${audioVolume === 0 ? 'Muted' : `${Math.round((audioVolume / 3) * 100)}%`}`}
              />
              
              {/* Volume Slider Popup */}
              {showVolumeSlider && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '8px',
                  backgroundColor: '#c0c0c0',
                  border: '2px outset #c0c0c0',
                  padding: '8px',
                  zIndex: 6000
                }}>
                  <div className="field-row">
                    <label htmlFor="range25">Message Volume</label>
                    <div className="is-vertical">
                      <input 
                        id="range25"
                        className="has-box-indicator" 
                        type="range" 
                        min="0" 
                        max="3"
                        step="1" 
                        value={audioVolume}
                        onChange={handleVolumeChange}
                      />
                    </div>
                  </div>
                </div>
              )}
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

        {/* Friends Window */}
{showFriendsWindow && auth.authId && (
  <FriendsWindow
    isOpen={showFriendsWindow}
    onClose={() => setShowFriendsWindow(false)}
    onOpenChat={() => { /* handle opening chat if needed */ }}
    theme={'win98'} // e.g., from your theme state
  />
)}

      </>
    );
  }

  // ✅ FIXED: Windows 7 TaskBar
  if (isWin7Mode) {
    return (
      <>
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
          {/* Start Button */}
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
                (e.target as HTMLImageElement).outerHTML = '<span style="color: white; font-size: 12px; font-weight: bold;">⊞</span>';
              }}
            />
          </button>

          {/* Taskbar items area */}
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
              minWidth: '180px',
              position: 'relative'
            }}
          >
            {/* Friends Control */}
            <img 
              src={getFriendsIcon()}
              alt="Friends"
              style={{ 
                width: '16px', 
                height: '16px', 
                cursor: 'pointer',
              
              }}
              onClick={handleFriendsIconClick}
              title="Friends"
            />

            {/* Audio Control */}
            <div className="volume-control-container" style={{ position: 'relative' }}>
              <img 
                src={getAudioIcon()}
                alt="Volume"
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  cursor: 'pointer',
              
                }}
                onClick={handleAudioIconClick}
                title={`Message Volume: ${audioVolume === 0 ? 'Muted' : `${Math.round((audioVolume / 3) * 100)}%`}`}
              />
              
              {/* Volume Slider Popup */}
              {showVolumeSlider && (
                <div className="glass active" style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '8px',
                  background: 'rgba(240, 240, 240, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '12px',
                  backdropFilter: 'blur(10px)',
                  zIndex: 6000,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}>
                  <div className="field-row">
                    <label>Message Volume</label>
                    <div className="is-vertical">
                      <input 
                        className="has-box-indicator" 
                        type="range" 
                        min="0" 
                        max="3"
                        step="1" 
                        value={audioVolume}
                        onChange={handleVolumeChange}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

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

        {/* Friends Window */}
        {showFriendsWindow && auth.authId && (
        <FriendsWindow
          isOpen={showFriendsWindow}
          onClose={() => setShowFriendsWindow(false)}
          onOpenChat={() => {}}
          theme={'win7'} // e.g., 'win7' | 'winxp' | 'win98'
        />
      )}

      </>
    );
  }

  // ✅ FIXED: Windows XP TaskBar
  if (isWinXPMode) {
    return (
      <>
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
          {/* Start Button */}
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
                (e.target as HTMLImageElement).outerHTML = '<span style="color: white; font-size: 12px;">⊞</span>';
              }}
            />
            <span>start</span>
          </button>

          {/* Task buttons area */}
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
              minWidth: '160px',
              position: 'relative'
            }}
          >
            {/* Friends Control */}
            <img 
              src={getFriendsIcon()}
              alt="Friends"
              style={{ 
                width: '16px', 
                height: '16px', 
                cursor: 'pointer',
                marginRight: '4px'
              }}
              onClick={handleFriendsIconClick}
              title="Friends"
            />

            {/* Audio Control */}
            <div className="volume-control-container" style={{ position: 'relative' }}>
              <img 
                src={getAudioIcon()}
                alt="Volume"
                style={{ 
                  width: '16px', 
                  height: '16px', 
                  cursor: 'pointer',
                  marginRight: '4px'
                }}
                onClick={handleAudioIconClick}
                title={`Message Volume: ${audioVolume === 0 ? 'Muted' : `${Math.round((audioVolume / 3) * 100)}%`}`}
              />
              
              {/* Volume Slider Popup */}
              {showVolumeSlider && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '8px',
                  background: '#ece9d8',
                  border: '2px outset #ece9d8',
                  borderRadius: '4px',
                  padding: '8px',
                  zIndex: 6000,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}>
                  <div className="field-row">
                    <label htmlFor="range28">Message Volume</label>
                    <div className="is-vertical">
                      <input 
                        id="range28"
                        className="has-box-indicator" 
                        type="range" 
                        min="0" 
                        max="3"
                        step="1" 
                        value={audioVolume}
                        onChange={handleVolumeChange}
                      />
                    </div>
                  </div>
                </div>
              )}
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

        {/* Friends Window */}
        {showFriendsWindow && auth.authId && (
  <FriendsWindow
    isOpen={showFriendsWindow}
    onClose={() => setShowFriendsWindow(false)}
    onOpenChat={() => {}}
    theme={'winxp'} // e.g., 'win7' | 'winxp' | 'win98'
  />
)}

      </>
    );
  }

  return null;
};