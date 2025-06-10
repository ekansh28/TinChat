// src/components/home/MainCard.tsx
import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import styles from '@/styles/page.module.css';

interface MainCardProps {
  currentInterest: string;
  setCurrentInterest: (value: string) => void;
  selectedInterests: string[];
  setSelectedInterests: React.Dispatch<React.SetStateAction<string[]>>;
  usersOnline: number | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onStartChat: (type: 'text' | 'video') => void;
  onToggleSettings: () => void;
  isNavigating: boolean;
  isMobile: boolean;
  toast: any;
}

export default function MainCard({
  currentInterest,
  setCurrentInterest,
  selectedInterests,
  setSelectedInterests,
  usersOnline,
  inputRef,
  onStartChat,
  onToggleSettings,
  isNavigating,
  isMobile,
  toast
}: MainCardProps) {
  
  const handleInterestInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInterest(e.target.value);
  }, [setCurrentInterest]);

  const addInterest = useCallback((interestToAdd: string) => {
    const newInterest = interestToAdd.trim().toLowerCase();
    if (newInterest && !selectedInterests.includes(newInterest) && selectedInterests.length < 5) {
      setSelectedInterests(prev => [...prev, newInterest]);
      setCurrentInterest('');
    } else if (newInterest && selectedInterests.includes(newInterest)) {
      toast({ 
        title: "Duplicate Interest", 
        description: `"${newInterest}" is already added.` 
      });
      setCurrentInterest('');
    } else if (selectedInterests.length >= 5) {
      toast({ 
        title: "Max Interests Reached", 
        description: "You can add up to 5 interests." 
      });
      setCurrentInterest('');
    }
  }, [selectedInterests, toast, setSelectedInterests, setCurrentInterest]);

  const handleInterestInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    const value = currentInterest.trim();

    if ((key === ',' || key === ' ' || key === 'Enter') && value) {
      e.preventDefault();
      addInterest(value);
    } else if (key === 'Backspace' && !currentInterest && selectedInterests.length > 0) {
      e.preventDefault();
      setSelectedInterests(prev => prev.slice(0, -1));
    }
  }, [currentInterest, selectedInterests.length, addInterest, setSelectedInterests]);

  const handleRemoveInterest = useCallback((interestToRemove: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setSelectedInterests(prev => prev.filter(interest => interest !== interestToRemove));
  }, [setSelectedInterests]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div className="window" style={{ width: '100%' }}>
      {/* Title Bar - Pure 98.css */}
      <div className="title-bar">
        <div className="title-bar-text">
          Welcome to TinChat!
        </div>
        
        {/* Online Users Indicator in title bar */}
        <div className={styles.onlineIndicator}>
          <img
            src="/icons/greenlight.gif"
            alt="Green light"
            style={{
              width: isMobile ? '10px' : '12px',
              height: isMobile ? '10px' : '12px',
              marginRight: '4px'
            }}
            data-ai-hint="green light indicator"
          />
          {usersOnline !== null ? (
            <span style={{ fontWeight: 'bold', marginRight: '4px' }}>{usersOnline}</span>
          ) : (
            <span style={{ fontWeight: 'bold', marginRight: '4px' }}>--</span>
          )}
          <span>Users Online!</span>
        </div>
      </div>
      
      {/* Window Body - Pure 98.css */}
      <div className="window-body">
        <p style={{ 
          fontSize: isMobile ? '14px' : '16px',
          textAlign: isMobile ? 'center' : 'left',
          marginBottom: '16px'
        }}>
          Connect with someone new. Add interests by typing them and pressing Comma, Space, or Enter. Max 5 interests.
        </p>
        
        {/* Interests Section using 98.css field-row-stacked */}
        <div className="field-row-stacked">
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '8px' : '0'
          }}>
            <label 
              htmlFor="interests-input-field"
              style={{
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: isMobile ? '500' : 'normal',
                color: 'black'
              }}
            >
              Your Interests
            </label>
            
            {/* Settings Button - Pure 98.css button */}
            <button
              aria-label="Settings"
              onClick={onToggleSettings}
              disabled={isNavigating}
              style={{ 
                padding: '2px',
                width: isMobile ? '32px' : '24px',
                height: isMobile ? '32px' : '24px',
                minWidth: isMobile ? '32px' : '24px'
              }}
            >
              <img
                src="/icons/gears-0.png"
                alt="Settings"
                style={{
                  width: isMobile ? '16px' : '12px',
                  height: isMobile ? '16px' : '12px',
                  objectFit: 'contain'
                }}
                data-ai-hint="settings icon"
              />
            </button>
          </div>
          
          {/* Interests Input using pure 98.css field-row */}
          <div
            className={`field-row ${styles.interestInputContainer}`}
            onClick={focusInput}
            style={{ cursor: 'text' }}
          >
            {selectedInterests.map((interest) => (
              <div
                key={interest}
                className={styles.interestTag}
              >
                <span>{interest}</span>
                <X
                  size={isMobile ? 12 : 14}
                  style={{ 
                    marginLeft: '4px',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    (e.target as HTMLElement).style.color = '#ccc';
                  }}
                  onMouseOut={(e) => {
                    (e.target as HTMLElement).style.color = 'white';
                  }}
                  onClick={(e) => handleRemoveInterest(interest, e)}
                  aria-label={`Remove ${interest}`}
                />
              </div>
            ))}
            <input
              id="interests-input-field"
              ref={inputRef}
              value={currentInterest}
              onChange={handleInterestInputChange}
              onKeyDown={handleInterestInputKeyDown}
              placeholder={selectedInterests.length < 5 ? "Add interest..." : "Max interests reached"}
              className={styles.interestInput}
              disabled={(selectedInterests.length >= 5 && !currentInterest) || isNavigating}
              autoComplete="off"
              autoCapitalize="none"
              style={{
                fontSize: isMobile ? '16px' : '14px',
                minWidth: isMobile ? '120px' : '80px'
              }}
            />
          </div>
          
          <p style={{
            color: '#666',
            marginTop: '8px',
            fontSize: isMobile ? '12px' : '12px',
            lineHeight: isMobile ? '1.5' : 'normal'
          }}>
            Type an interest and press Comma, Space, or Enter. Backspace on empty input to remove last. Leave blank for random match.
          </p>
        </div>
        
        {/* Action Buttons Section using 98.css buttons */}
        <section className="field-row" style={{ 
          justifyContent: 'space-between',
          marginTop: '16px',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '8px'
        }}>
          <button 
            onClick={() => onStartChat('text')} 
            disabled={isNavigating}
            style={{ 
              flex: isMobile ? 'none' : '1',
              width: isMobile ? '100%' : 'auto',
              height: isMobile ? '48px' : 'auto',
              fontSize: isMobile ? '16px' : '14px'
            }}
          >
            {isNavigating ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid transparent',
                  borderTop: '2px solid black',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }}></div>
                Starting...
              </div>
            ) : (
              <span>Start Text Chat</span>
            )}
          </button>
          
          <button 
            onClick={() => onStartChat('video')} 
            disabled={isNavigating}
            style={{ 
              flex: isMobile ? 'none' : '1',
              width: isMobile ? '100%' : 'auto',
              height: isMobile ? '48px' : 'auto',
              fontSize: isMobile ? '16px' : '14px'
            }}
          >
            {isNavigating ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid transparent',
                  borderTop: '2px solid black',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }}></div>
                Starting...
              </div>
            ) : (
              <span>Start Video Chat</span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
}