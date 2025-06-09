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

// Advanced interaction system
class InteractionSystem {
  private static instance: InteractionSystem;
  private hoverTimeouts = new Map<string, NodeJS.Timeout>();
  private animationFrames = new Map<string, number>();
  private performanceMonitor = {
    renderCount: 0,
    lastRenderTime: 0,
    avgFrameTime: 16.67 // Target 60fps
  };

  static getInstance(): InteractionSystem {
    if (!InteractionSystem.instance) {
      InteractionSystem.instance = new InteractionSystem();
    }
    return InteractionSystem.instance;
  }

  scheduleHoverEffect(elementId: string, callback: () => void, delay: number = 150) {
    this.clearHoverEffect(elementId);
    
    const timeout = setTimeout(callback, delay);
    this.hoverTimeouts.set(elementId, timeout);
  }

  clearHoverEffect(elementId: string) {
    const timeout = this.hoverTimeouts.get(elementId);
    if (timeout) {
      clearTimeout(timeout);
      this.hoverTimeouts.delete(elementId);
    }
  }

  scheduleAnimation(elementId: string, callback: () => void) {
    this.cancelAnimation(elementId);
    
    const frame = requestAnimationFrame(() => {
      callback();
      this.animationFrames.delete(elementId);
      this.updatePerformanceMetrics();
    });
    
    this.animationFrames.set(elementId, frame);
  }

  cancelAnimation(elementId: string) {
    const frame = this.animationFrames.get(elementId);
    if (frame) {
      cancelAnimationFrame(frame);
      this.animationFrames.delete(elementId);
    }
  }

  private updatePerformanceMetrics() {
    const now = performance.now();
    if (this.performanceMonitor.lastRenderTime > 0) {
      const frameTime = now - this.performanceMonitor.lastRenderTime;
      this.performanceMonitor.avgFrameTime = 
        this.performanceMonitor.avgFrameTime * 0.9 + frameTime * 0.1;
    }
    this.performanceMonitor.lastRenderTime = now;
    this.performanceMonitor.renderCount++;
  }

  getPerformanceStats() {
    return {
      ...this.performanceMonitor,
      fps: 1000 / this.performanceMonitor.avgFrameTime
    };
  }

  cleanup() {
    this.hoverTimeouts.forEach(timeout => clearTimeout(timeout));
    this.animationFrames.forEach(frame => cancelAnimationFrame(frame));
    this.hoverTimeouts.clear();
    this.animationFrames.clear();
  }
}

// Advanced visual effects
const useVisualEffects = (cssMode: string, selectedElements: string[]) => {
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const [rippleEffects, setRippleEffects] = useState<Map<string, {x: number, y: number, timestamp: number}>>(new Map());

  const interactionSystem = useMemo(() => InteractionSystem.getInstance(), []);

  const createRippleEffect = useCallback((elementId: string, x: number, y: number) => {
    if (cssMode !== 'easy') return;
    
    setRippleEffects(prev => {
      const newMap = new Map(prev);
      newMap.set(elementId, { x, y, timestamp: Date.now() });
      
      // Clean up old ripples
      setTimeout(() => {
        setRippleEffects(current => {
          const updated = new Map(current);
          updated.delete(elementId);
          return updated;
        });
      }, 600);
      
      return newMap;
    });
  }, [cssMode]);

  const handleElementHover = useCallback((elementId: string, isHovering: boolean) => {
    if (cssMode !== 'easy') return;

    if (isHovering) {
      interactionSystem.scheduleHoverEffect(elementId, () => {
        setHoveredElement(elementId);
      });
    } else {
      interactionSystem.clearHoverEffect(elementId);
      setHoveredElement(null);
    }
  }, [cssMode, interactionSystem]);

  useEffect(() => {
    return () => {
      interactionSystem.cleanup();
    };
  }, [interactionSystem]);

  return {
    hoveredElement,
    focusedElement,
    rippleEffects,
    createRippleEffect,
    handleElementHover,
    setFocusedElement
  };
};

// Smart image loading with optimization
const useImageOptimization = () => {
  const [imageCache] = useState(new Map<string, { loaded: boolean, error: boolean, optimized?: string }>());
  const [loadingStates, setLoadingStates] = useState(new Map<string, boolean>());

  const optimizeImage = useCallback(async (url: string, maxWidth: number = 400): Promise<string> => {
    if (imageCache.has(url)) {
      const cached = imageCache.get(url);
      return cached?.optimized || url;
    }

    try {
      // Create a canvas to resize the image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve(url);
            return;
          }

          // Calculate optimal dimensions
          const aspectRatio = img.width / img.height;
          const newWidth = Math.min(img.width, maxWidth);
          const newHeight = newWidth / aspectRatio;

          canvas.width = newWidth;
          canvas.height = newHeight;

          // Draw and compress
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          const optimizedUrl = canvas.toDataURL('image/webp', 0.8);
          
          imageCache.set(url, { loaded: true, error: false, optimized: optimizedUrl });
          resolve(optimizedUrl);
        };

        img.onerror = () => {
          imageCache.set(url, { loaded: false, error: true });
          reject(new Error('Failed to load image'));
        };

        img.src = url;
      });
    } catch (error) {
      imageCache.set(url, { loaded: false, error: true });
      return url;
    }
  }, [imageCache]);

  const loadImage = useCallback(async (url: string, elementId: string) => {
    setLoadingStates(prev => new Map(prev).set(elementId, true));
    
    try {
      const optimizedUrl = await optimizeImage(url);
      setLoadingStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(elementId);
        return newMap;
      });
      return optimizedUrl;
    } catch (error) {
      setLoadingStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(elementId);
        return newMap;
      });
      throw error;
    }
  }, [optimizeImage]);

  return { loadImage, loadingStates, imageCache };
};

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
  const [optimizedImages, setOptimizedImages] = useState<Map<string, string>>(new Map());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  
  const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
  const finalAvatarUrl = avatarPreview || avatarUrl;
  const finalBannerUrl = bannerPreview || bannerUrl;

  const { loadImage, loadingStates } = useImageOptimization();
  const {
    hoveredElement,
    rippleEffects,
    createRippleEffect,
    handleElementHover,
    setFocusedElement
  } = useVisualEffects(cssMode, selectedElements);

  // Optimize images on load
  useEffect(() => {
    const optimizeImages = async () => {
      const imagesToOptimize: Array<{url: string, id: string}> = [];
      
      if (finalAvatarUrl) imagesToOptimize.push({ url: finalAvatarUrl, id: 'avatar' });
      if (finalBannerUrl) imagesToOptimize.push({ url: finalBannerUrl, id: 'banner' });
      
      badges.forEach((badge, index) => {
        imagesToOptimize.push({ url: badge.url, id: `badge-${index}` });
      });

      for (const { url, id } of imagesToOptimize) {
        try {
          const optimizedUrl = await loadImage(url, id);
          setOptimizedImages(prev => new Map(prev).set(id, optimizedUrl));
        } catch (error) {
          setImageErrors(prev => new Set(prev).add(id));
        }
      }
    };

    optimizeImages();
  }, [finalAvatarUrl, finalBannerUrl, badges, loadImage]);

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
              "hover:bg-blue-600 hover:shadow-xl"
            )}
            data-handle={handle}
            style={{
              width: '10px',
              height: '10px',
              cursor: `${handle}-resize`,
              zIndex: 1000,
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
    const isHovered = hoveredElement === element;
    const ripple = rippleEffects.get(element);
    
    return (
      <div
        className={cn(
          element,
          "relative transition-all duration-200",
          isSelected && cssMode === 'easy' && 'z-10',
          isHovered && cssMode === 'easy' && 'transform hover:scale-105',
          cssMode === 'easy' && 'cursor-move'
        )}
        onMouseDown={onMouseDown ? (e) => {
          e.stopPropagation();
          createRippleEffect(element, e.clientX, e.clientY);
          onMouseDown(e, element);
        } : undefined}
        onMouseEnter={() => handleElementHover(element, true)}
        onMouseLeave={() => handleElementHover(element, false)}
        onContextMenu={onContextMenu ? (e) => {
          e.stopPropagation();
          onContextMenu(e, element);
        } : undefined}
        onDoubleClick={onRightClick ? (e) => {
          e.stopPropagation();
          onRightClick(e, element);
        } : undefined}
        onFocus={() => setFocusedElement(element)}
        onBlur={() => setFocusedElement(null)}
        tabIndex={cssMode === 'easy' ? 0 : -1}
        role={cssMode === 'easy' ? 'button' : undefined}
        aria-label={cssMode === 'easy' ? `Edit ${element.replace('profile-', '')}` : undefined}
        style={{
          userSelect: cssMode === 'easy' ? 'none' : 'auto',
          outline: 'none'
        }}
      >
        {children}
        {renderResizeHandles(element)}
        
        {/* Ripple effect */}
        {ripple && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: ripple.x - 50,
              top: ripple.y - 50,
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
              transform: 'scale(0)',
              animation: 'ripple 0.6s ease-out forwards'
            }}
          />
        )}
        
        {/* Hover overlay for easy mode */}
        {cssMode === 'easy' && isHovered && !isSelected && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded pointer-events-none transition-opacity duration-200" />
        )}
        
        {/* Loading overlay */}
        {loadingStates.get(`${element}-image`) && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }, [isElementSelected, hoveredElement, rippleEffects, cssMode, onMouseDown, onContextMenu, onRightClick, handleElementHover, setFocusedElement, createRippleEffect, renderResizeHandles, loadingStates]);

  // Memoized CSS with performance optimizations
  const optimizedCSS = useMemo(() => {
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
      @keyframes ripple {
        0% {
          transform: scale(0);
          opacity: 1;
        }
        100% {
          transform: scale(4);
          opacity: 0;
        }
      }
      
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

  // Smart image rendering with fallbacks
  const renderOptimizedImage = useCallback((
    src: string, 
    alt: string, 
    className: string,
    imageId: string,
    fallbackComponent?: React.ReactNode
  ) => {
    const optimizedSrc = optimizedImages.get(imageId) || src;
    const hasError = imageErrors.has(imageId);
    const isLoading = loadingStates.get(imageId);

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
          src={optimizedSrc}
          alt={alt}
          className={cn(className, isLoading && "opacity-0")}
          onError={() => setImageErrors(prev => new Set(prev).add(imageId))}
          onLoad={() => {
            setImageErrors(prev => {
              const newSet = new Set(prev);
              newSet.delete(imageId);
              return newSet;
            });
          }}
          draggable={false}
          loading="lazy"
        />
      </>
    );
  }, [optimizedImages, imageErrors, loadingStates]);

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

        {/* Performance indicator for easy mode */}
        {cssMode === 'easy' && process.env.NODE_ENV === 'development' && (
          <div className="absolute top-2 right-2 text-xs bg-black bg-opacity-50 text-white px-2 py-1 rounded">
            FPS: {Math.round(InteractionSystem.getInstance().getPerformanceStats().fps)}
          </div>
        )}
      </div>
    </div>
  );
};