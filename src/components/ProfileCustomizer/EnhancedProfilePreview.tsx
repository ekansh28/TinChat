// src/components/ProfileCustomizer/EnhancedProfilePreview.tsx
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState<Set<string>>(new Set());
  
  const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
  const finalAvatarUrl = avatarPreview || avatarUrl;
  const finalBannerUrl = bannerPreview || bannerUrl;

  const isElementSelected = useCallback((element: string) => {
    return selectedElements.includes(element) || selectedElement === element;
  }, [selectedElements, selectedElement]);

  const getStatusColor = useCallback((status: StatusType) => {
    switch (status) {
      case 'online': return '#43b883';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#747f8d';
    }
  }, []);

  // Enhanced resize handles with better visual feedback
  const renderResizeHandles = useCallback((element: string) => {
    if (cssMode !== 'easy' || !isElementSelected(element)) return null;

    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    
    return (
      <>
        {handles.map(handle => (
          <div
            key={handle}
            className={cn(
              "resize-handle resize-handle-" + handle,
              "absolute transition-all duration-200 hover:scale-125",
              "bg-blue-500 border-2 border-white rounded-full shadow-lg",
              "hover:bg-blue-600 hover:shadow-xl z-50"
            )}
            data-handle={handle}
            style={{
              width: '10px',
              height: '10px',
              cursor: `${handle}-resize`,
              ...getHandlePosition(handle)
            }}
          />
        ))}
        
        {/* Selection outline */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            border: '2px solid #3b82f6',
            borderRadius: '4px',
            background: 'rgba(59, 130, 246, 0.1)',
            animation: 'pulse 2s infinite'
          }}
        />
      </>
    );
  }, [cssMode, isElementSelected]);

  const getHandlePosition = useCallback((handle: string) => {
    const offset = -5;
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
  }, []);

  // Enhanced element wrapper with advanced interactions
  const renderElement = useCallback((element: string, children: React.ReactNode) => {
    const isSelected = isElementSelected(element);
    
    return (
      <div
        className={cn(
          element,
          "relative transition-all duration-200",
          isSelected && cssMode === 'easy' && 'z-10',
          cssMode === 'easy' && 'cursor-move'
        )}
        onMouseDown={onMouseDown ? (e) => {
          e.stopPropagation();
          onMouseDown(e, element);
        } : undefined}
        onContextMenu={onContextMenu ? (e) => {
          e.stopPropagation();
          onContextMenu(e, element);
        } : undefined}
        onDoubleClick={onRightClick ? (e) => {
          e.stopPropagation();
          onRightClick(e, element);
        } : undefined}
        style={{
          userSelect: cssMode === 'easy' ? 'none' : 'auto',
          outline: 'none'
        }}
      >
        {children}
        {renderResizeHandles(element)}
        
        {/* Loading overlay */}
        {imageLoading.has(`${element}-image`) && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }, [isElementSelected, cssMode, onMouseDown, onContextMenu, onRightClick, renderResizeHandles, imageLoading]);

  // Handle image errors and loading
  const handleImageError = useCallback((imageId: string) => {
    setImageErrors(prev => new Set(prev).add(imageId));
    setImageLoading(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  }, []);

  const handleImageLoad = useCallback((imageId: string) => {
    setImageLoading(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  }, []);

  const handleImageLoadStart = useCallback((imageId: string) => {
    setImageLoading(prev => new Set(prev).add(imageId));
  }, []);

  // Smart image rendering with fallbacks
  const renderOptimizedImage = useCallback((
    src: string, 
    alt: string, 
    className: string,
    imageId: string,
    fallbackComponent?: React.ReactNode
  ) => {
    const hasError = imageErrors.has(imageId);
    const isLoading = imageLoading.has(imageId);

    if (hasError) {
      return fallbackComponent || (
        <div className={cn(className, "bg-gray-300 dark:bg-gray-600 flex items-center justify-center")}>
          <span className="text-gray-500 text-lg">🖼️</span>
        </div>
      );
    }

    return (
      <>
        {isLoading && (
          <div className={cn(className, "absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center")}>
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <img
          src={src}
          alt={alt}
          className={cn(className, isLoading && "opacity-0")}
          onError={() => handleImageError(imageId)}
          onLoad={() => handleImageLoad(imageId)}
          onLoadStart={() => handleImageLoadStart(imageId)}
          draggable={false}
          loading="lazy"
        />
      </>
    );
  }, [imageErrors, imageLoading, handleImageError, handleImageLoad, handleImageLoadStart]);

  // Memoized CSS with performance optimizations
  const optimizedCSS = useMemo(() => {
    if (!customCSS || typeof customCSS !== 'string') {
      return '';
    }

    return `
      ${customCSS}
      
      /* Performance optimizations */
      .profile-card-container {
        contain: layout style paint;
        will-change: auto;
        backface-visibility: hidden;
        transform: translateZ(0);
      }
      
      /* Enhanced animations */
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
      
      /* Smooth transitions for all interactive elements */
      [class*="profile-"] {
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* Enhanced focus styles */
      [class*="profile-"]:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      
      /* Accessibility improvements */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
  }, [customCSS]);

  return (
    <div className="flex justify-center items-center min-h-full p-4">
      <style dangerouslySetInnerHTML={{ __html: optimizedCSS }} />
      
      <div 
        ref={previewRef || containerRef}
        className={cn(
          "profile-card-container relative transition-all duration-300",
          isTheme98 && "theme-98",
          cssMode === 'easy' && "hover:shadow-2xl"
        )}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          userSelect: cssMode === 'easy' ? 'none' : 'auto'
        }}
      >
        {/* Banner */}
        {renderElement('profile-banner', (
          <div className="profile-banner relative overflow-hidden">
            {finalBannerUrl ? (
              renderOptimizedImage(
                finalBannerUrl,
                "Profile banner",
                "w-full h-full object-cover",
                "banner"
              )
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            )}
          </div>
        ))}

        {/* Badges */}
        {badges.length > 0 && renderElement('profile-badges', (
          <div className="profile-badges">
            {badges.map((badge, index) => (
              <div 
                key={badge.id} 
                className={cn(
                  "profile-badge transition-transform duration-200 hover:scale-110",
                  cssMode === 'easy' && "cursor-pointer"
                )}
                title={badge.name || 'Badge'}
                onClick={cssMode === 'easy' ? (e) => e.stopPropagation() : undefined}
              >
                {renderOptimizedImage(
                  badge.url,
                  badge.name || 'Badge',
                  "w-full h-full object-cover",
                  `badge-${index}`,
                  <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs">
                    📛
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Content */}
        <div className="profile-content">
          {/* Avatar */}
          {renderElement('profile-avatar', (
            <div className="profile-avatar-container">
              <div className="profile-avatar relative overflow-hidden">
                {finalAvatarUrl ? (
                  renderOptimizedImage(
                    finalAvatarUrl,
                    "Profile avatar",
                    "w-full h-full object-cover",
                    "avatar",
                    <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-2xl">
                      👤
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-500 text-2xl">
                    👤
                  </div>
                )}
              </div>
              
              {/* Status Indicator */}
              {renderElement('profile-status', (
                <div 
                  className={cn(
                    "profile-status transition-all duration-200",
                    cssMode === 'easy' && "hover:scale-110"
                  )}
                  style={{ backgroundColor: getStatusColor(status) }}
                  title={statusOption?.label || 'Unknown Status'}
                />
              ))}
            </div>
          ))}

          {/* Display Name */}
          {displayName && renderElement('profile-display-name', (
            <div 
              className={cn(
                "profile-display-name transition-all duration-300",
                displayNameAnimation === 'rainbow' && 'display-name-rainbow',
                displayNameAnimation === 'gradient' && 'display-name-gradient',
                displayNameAnimation === 'pulse' && 'display-name-pulse',
                displayNameAnimation === 'glow' && 'display-name-glow'
              )}
              style={{
                color: displayNameAnimation === 'none' ? displayNameColor : undefined,
                wordBreak: 'break-word',
                hyphens: 'auto'
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
                className="w-3 h-3 rounded-full transition-all duration-200"
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
            <div 
              className="profile-bio"
              style={{
                wordBreak: 'break-word',
                hyphens: 'auto'
              }}
            >
              {bio}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};