// src/components/ProfileCustomizer/EnhancedProfilePreview.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_OPTIONS } from './utils/constants';
import type { Badge, StatusType, DisplayNameAnimation } from './types';

interface EnhancedProfilePreviewProps {
  customCSS: string;
  bio: string;
  displayName: string;
  username: string;
  pronouns: string;
  status: StatusType;
  displayNameColor: string;
  displayNameAnimation: DisplayNameAnimation;
  avatarPreview: string | null;
  avatarUrl: string | null;
  bannerPreview: string | null;
  bannerUrl: string | null;
  badges: Badge[];
  cssMode: 'custom' | 'easy';
  isTheme98: boolean;
  onMouseDown?: (e: React.MouseEvent, element: string) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  onContextMenu?: (e: React.MouseEvent, element: string) => void;
  onRightClick?: (e: React.MouseEvent, element: string) => void;
  previewRef?: React.RefObject<HTMLDivElement>;
  selectedElement?: string | null;
  selectedElements?: string[];
}

export const EnhancedProfilePreview: React.FC<EnhancedProfilePreviewProps> = ({
  customCSS,
  bio,
  displayName,
  username,
  pronouns,
  status,
  displayNameColor,
  displayNameAnimation,
  avatarPreview,
  avatarUrl,
  bannerPreview,
  bannerUrl,
  badges,
  cssMode,
  isTheme98,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onContextMenu,
  onRightClick,
  previewRef,
  selectedElement,
  selectedElements = []
}) => {
  const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
  const finalAvatarUrl = avatarPreview || avatarUrl;
  const finalBannerUrl = bannerPreview || bannerUrl;

  const isElementSelected = (element: string) => {
    return selectedElements.includes(element) || selectedElement === element;
  };

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case 'online': return '#43b883';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#747f8d';
    }
  };

  const renderResizeHandles = (element: string) => {
    if (cssMode !== 'easy' || !isElementSelected(element)) return null;

    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    
    return (
      <>
        {handles.map(handle => (
          <div
            key={handle}
            className={`resize-handle resize-handle-${handle}`}
            data-handle={handle}
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: '#007acc',
              border: '1px solid white',
              cursor: `${handle}-resize`,
              zIndex: 1000,
              ...getHandlePosition(handle)
            }}
          />
        ))}
      </>
    );
  };

  const getHandlePosition = (handle: string) => {
    const offset = -4;
    switch (handle) {
      case 'nw': return { top: offset, left: offset };
      case 'ne': return { top: offset, right: offset };
      case 'sw': return { bottom: offset, left: offset };
      case 'se': return { bottom: offset, right: offset };
      case 'n': return { top: offset, left: '50%', transform: 'translateX(-50%)' };
      case 's': return { bottom: offset, left: '50%', transform: 'translateX(-50%)' };
      case 'e': return { right: offset, top: '50%', transform: 'translateY(-50%)' };
      case 'w': return { left: offset, top: '50%', transform: 'translateY(-50%)' };
      default: return {};
    }
  };

  const renderElement = (element: string, children: React.ReactNode) => {
    const isSelected = isElementSelected(element);
    
    return (
      <div
        className={cn(
          element,
          isSelected && cssMode === 'easy' && 'ring-2 ring-blue-500 ring-opacity-50',
          cssMode === 'easy' && 'cursor-move'
        )}
        onMouseDown={onMouseDown ? (e) => onMouseDown(e, element) : undefined}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, element) : undefined}
        onDoubleClick={onRightClick ? (e) => onRightClick(e, element) : undefined}
        style={{
          position: 'relative',
          userSelect: cssMode === 'easy' ? 'none' : 'auto'
        }}
      >
        {children}
        {renderResizeHandles(element)}
      </div>
    );
  };

  return (
    <div className="flex justify-center items-center min-h-full p-4">
      <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      
      <div 
        ref={previewRef}
        className={cn(
          "profile-card-container relative",
          isTheme98 && "theme-98"
        )}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Banner */}
        {renderElement('profile-banner', (
          <div className="profile-banner">
            {finalBannerUrl && (
              <img 
                src={finalBannerUrl} 
                alt="Profile banner" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            )}
          </div>
        ))}

        {/* Badges */}
        {badges.length > 0 && renderElement('profile-badges', (
          <div className="profile-badges">
            {badges.map((badge) => (
              <div key={badge.id} className="profile-badge">
                <img 
                  src={badge.url} 
                  alt={badge.name || 'Badge'} 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/icons/broken-badge.png';
                  }}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Content */}
        <div className="profile-content">
          {/* Avatar */}
          {renderElement('profile-avatar', (
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                {finalAvatarUrl ? (
                  <img 
                    src={finalAvatarUrl} 
                    alt="Profile avatar" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-500">
                    👤
                  </div>
                )}
              </div>
              
              {/* Status Indicator */}
              {renderElement('profile-status', (
                <div 
                  className="profile-status"
                  style={{ backgroundColor: getStatusColor(status) }}
                />
              ))}
            </div>
          ))}

          {/* Display Name */}
          {displayName && renderElement('profile-display-name', (
            <div 
              className={cn(
                "profile-display-name",
                displayNameAnimation === 'rainbow' && 'display-name-rainbow',
                displayNameAnimation === 'gradient' && 'display-name-gradient',
                displayNameAnimation === 'pulse' && 'display-name-pulse',
                displayNameAnimation === 'glow' && 'display-name-glow'
              )}
              style={{
                color: displayNameAnimation === 'none' ? displayNameColor : undefined
              }}
            >
              {displayName}
            </div>
          ))}

          {/* Username */}
          {username && renderElement('profile-username', (
            <div className="profile-username">@{username}</div>
          ))}

          {/* Pronouns */}
          {pronouns && renderElement('profile-pronouns', (
            <div className="profile-pronouns">{pronouns}</div>
          ))}

          {/* Status Text */}
          {statusOption && renderElement('profile-status-text', (
            <div className="profile-status-text">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getStatusColor(status) }}
              />
              {statusOption.label}
            </div>
          ))}

          {/* Divider */}
          {bio && renderElement('profile-divider', (
            <div className="profile-divider" />
          ))}

          {/* Bio */}
          {bio && renderElement('profile-bio', (
            <div className="profile-bio">{bio}</div>
          ))}
        </div>
      </div>
    </div>
  );
};