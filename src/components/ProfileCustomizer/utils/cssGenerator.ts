// src/components/ProfileCustomizer/utils/cssGenerator.ts
import type { EasyCustomization, DisplayNameAnimation } from '../types';
import { getDefaultProfileCSS } from '@/lib/SafeCSS';

// Performance-optimized CSS generation with enhanced caching
class CSSGenerator {
  private cache = new Map<string, { css: string; timestamp: number }>();
  private readonly MAX_CACHE_SIZE = 10;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private lastGeneratedHash = '';

  // Generate a hash for the current configuration
  private generateHash(
    easyCustomization: EasyCustomization,
    displayNameAnimation: DisplayNameAnimation,
    rainbowSpeed: number
  ): string {
    return JSON.stringify({ easyCustomization, displayNameAnimation, rainbowSpeed });
  }

  // Improved cache management
  private manageCacheSize(): void {
    // Remove expired entries
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }

    // Remove oldest entries if still over limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, this.cache.size - this.MAX_CACHE_SIZE + 1);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  generateCSS(
    easyCustomization: EasyCustomization,
    displayNameAnimation: DisplayNameAnimation,
    rainbowSpeed: number
  ): string {
    const configHash = this.generateHash(easyCustomization, displayNameAnimation, rainbowSpeed);
    
    // Check cache with TTL
    const cached = this.cache.get(configHash);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.css;
    }

    try {
      // Validate input data
      if (!easyCustomization || typeof easyCustomization !== 'object') {
        console.warn('Invalid easyCustomization provided to CSS generator');
        return getDefaultProfileCSS();
      }

      const css = this.buildCSS(easyCustomization, displayNameAnimation, rainbowSpeed);
      
      // Manage cache size before adding
      this.manageCacheSize();
      
      // Cache with timestamp
      this.cache.set(configHash, {
        css,
        timestamp: Date.now()
      });
      
      this.lastGeneratedHash = configHash;
      return css;
    } catch (error) {
      console.error('Error generating CSS:', error);
      return getDefaultProfileCSS();
    }
  }

  private buildCSS(
    easyCustomization: EasyCustomization,
    displayNameAnimation: DisplayNameAnimation,
    rainbowSpeed: number
  ): string {
    if (!easyCustomization || !easyCustomization.elements) {
      return getDefaultProfileCSS();
    }

    const cssBlocks: string[] = [];

    // Base clean profile card CSS
    cssBlocks.push(`
/* Clean Profile Card without hover effects */
.profile-card-container {
  background: ${this.generateBackground(easyCustomization)};
  border-radius: ${easyCustomization.borderRadius || 16}px;
  padding: 0;
  color: white;
  font-family: 'MS Sans Serif', sans-serif;
  width: 300px;
  min-height: 500px;
  position: relative;
  overflow: visible;
  
  ${this.generateShadowCSS(easyCustomization)}
  ${easyCustomization.border ? 'border: 2px solid rgba(255, 255, 255, 0.3);' : ''}
}

/* Remove all hover effects from profile card */
.profile-card-container:hover {
  transform: none !important;
  box-shadow: ${this.generateShadowCSS(easyCustomization).replace('box-shadow: ', '').replace(';', '')};
}

/* Banner without container constraints */
.profile-banner {
  width: 100%;
  height: ${easyCustomization.bannerHeight || 120}px;
  background: linear-gradient(45deg, #667eea, #764ba2);
  position: relative;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.profile-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Remove banner hover effects */
.profile-banner:hover,
.profile-banner:hover img {
  transform: none !important;
}

/* Content area with proper positioning */
.profile-content {
  padding: ${easyCustomization.contentPadding || 16}px;
  position: relative;
  margin-top: -30px;
  z-index: 2;
}

/* Avatar without nested containers */
.profile-avatar {
  width: ${easyCustomization.avatarSize || 80}px;
  height: ${easyCustomization.avatarSize || 80}px;
  border-radius: ${easyCustomization.avatarFrame === 'circle' ? '50%' : '12px'};
  border: 4px solid rgba(255, 255, 255, 0.2);
  object-fit: cover;
  background: #2f3136;
  display: block;
  margin-bottom: 12px;
  position: relative;
}

/* Remove avatar hover effects */
.profile-avatar:hover {
  transform: none !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

/* Status indicator positioned relative to avatar */
.profile-status {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border: 2px solid white;
  border-radius: 50%;
  z-index: 3;
  pointer-events: none;
}

/* Remove status hover effects */
.profile-status:hover {
  transform: none !important;
}

/* Badge container with horizontal scroll */
.profile-badges {
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin: 16px 0;
  padding: 8px 0;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.profile-badges::-webkit-scrollbar {
  height: 4px;
}

.profile-badges::-webkit-scrollbar-track {
  background: transparent;
}

.profile-badges::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

/* Rectangular badge layout */
.profile-badge {
  min-width: 48px;
  width: 48px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Remove badge hover effects */
.profile-badge:hover {
  transform: none !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}

.profile-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

/* Text elements without background colors */
.profile-display-name {
  font-size: ${Math.max(18, (easyCustomization.fontSize || 16) + 6)}px;
  font-weight: ${easyCustomization.textBold ? '700' : '600'};
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  margin-bottom: 4px;
  word-wrap: break-word;
  line-height: 1.2;
  background: none !important;
  
  ${this.generateTextEffects(easyCustomization)}
}

.profile-username {
  font-size: ${Math.max(12, (easyCustomization.fontSize || 16) - 2)}px;
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  opacity: 0.8;
  margin-bottom: 4px;
  font-weight: 400;
  color: #b9bbbe;
  background: none !important;
}

.profile-pronouns {
  font-size: ${Math.max(10, (easyCustomization.fontSize || 16) - 4)}px;
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  opacity: 0.8;
  margin-bottom: 12px;
  display: inline-block;
  color: #dee2e6;
  background: none !important;
  border: none !important;
  padding: 0 !important;
}

/* Remove pronouns hover effects */
.profile-pronouns:hover {
  background: none !important;
  transform: none !important;
}

.profile-status-text {
  font-size: ${Math.max(10, (easyCustomization.fontSize || 16) - 4)}px;
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  opacity: 0.9;
  margin-bottom: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #b9bbbe;
  background: none !important;
}

.profile-bio {
  font-size: ${Math.max(12, (easyCustomization.fontSize || 16) - 2)}px;
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  line-height: 1.4;
  opacity: 0.95;
  margin-top: 12px;
  word-wrap: break-word;
  color: #dcddde;
  background: none !important;
  border: none !important;
  padding: 0 !important;
}

/* Remove bio hover effects */
.profile-bio:hover {
  background: none !important;
  transform: none !important;
}

.profile-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 16px 0;
  border-radius: 1px;
}

/* Constrain elements within profile card */
.profile-card-container * {
  max-width: 100%;
  overflow: hidden;
}

/* Easy mode editing styles */
.profile-card-container.editing-mode {
  overflow: visible !important;
  min-height: 600px;
}

.profile-card-container.editing-mode .profile-content {
  overflow: visible !important;
}

/* Selection and resize handles */
.element-selected {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px;
  position: relative !important;
}

.resize-handle {
  position: absolute;
  background: #3b82f6;
  border: 2px solid white;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  z-index: 1000;
  cursor: pointer;
}

.resize-handle-nw { top: -6px; left: -6px; cursor: nw-resize; }
.resize-handle-ne { top: -6px; right: -6px; cursor: ne-resize; }
.resize-handle-sw { bottom: -6px; left: -6px; cursor: sw-resize; }
.resize-handle-se { bottom: -6px; right: -6px; cursor: se-resize; }
.resize-handle-n { top: -6px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
.resize-handle-s { bottom: -6px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
.resize-handle-e { right: -6px; top: 50%; transform: translateY(-50%); cursor: e-resize; }
.resize-handle-w { left: -6px; top: 50%; transform: translateY(-50%); cursor: w-resize; }
`);

    // Display name animations
    cssBlocks.push(this.generateDisplayNameAnimations(displayNameAnimation, rainbowSpeed));

    // Element positioning and transformations
    cssBlocks.push(this.generateElementTransforms(easyCustomization.elements));

    // Theme-specific overrides
    cssBlocks.push(this.generateThemeOverrides());

    return cssBlocks.join('\n');
  }

  private generateBackground(config: EasyCustomization): string {
    if (config.backgroundGradient?.enabled) {
      const { color1, color2, direction } = config.backgroundGradient;
      if (direction === 'radial') {
        return `radial-gradient(circle, ${color1}, ${color2})`;
      }
      return `linear-gradient(${direction}, ${color1}, ${color2})`;
    }
    return config.backgroundColor || '#667eea';
  }

  private generateShadowCSS(config: EasyCustomization): string {
    const shadows: string[] = [];
    
    if (config.shadow) {
      shadows.push('0 8px 16px rgba(0, 0, 0, 0.24)');
    }
    
    if (config.glow) {
      shadows.push('0 0 30px rgba(102, 126, 234, 0.4)');
    }
    
    return shadows.length > 0 ? `box-shadow: ${shadows.join(', ')};` : '';
  }

  private generateTextEffects(config: EasyCustomization): string {
    const effects: string[] = [];
    
    if (config.textShadow) {
      effects.push('text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);');
    }
    
    if (config.textGlow) {
      effects.push('text-shadow: 0 0 10px currentColor, 0 0 20px currentColor;');
    }
    
    return effects.join(' ');
  }

  private generateDisplayNameAnimations(animation: DisplayNameAnimation, speed: number): string {
    return `
/* Display Name Animations */
.display-name-rainbow {
  background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow ${speed}s ease-in-out infinite;
}

@keyframes rainbow {
  0% { background-position: 0% 50%; }
  25% { background-position: 100% 0%; }
  50% { background-position: 100% 100%; }
  75% { background-position: 0% 100%; }
  100% { background-position: 0% 50%; }
}

.display-name-gradient {
  background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 6s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.display-name-pulse {
  animation: textPulse 2s ease-in-out infinite;
}

@keyframes textPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.display-name-glow {
  text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
  animation: textGlow 3s ease-in-out infinite alternate;
}

@keyframes textGlow {
  from { 
    text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
  }
  to { 
    text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor;
  }
}
`;
  }

  // Safe element transformation generation
  private generateElementTransforms(elements: EasyCustomization['elements']): string {
    if (!elements || typeof elements !== 'object') return '';
    
    const transformCSS: string[] = [];
    
    Object.entries(elements).forEach(([element, props]) => {
      if (!props || typeof props !== 'object') return;
      
      const styles: string[] = [];
      
      // Safe property access with validation
      const safeProps = {
        visible: typeof props.visible === 'boolean' ? props.visible : true,
        x: Number.isFinite(props.x) ? props.x : 0,
        y: Number.isFinite(props.y) ? props.y : 0,
        scale: Number.isFinite(props.scale) && props.scale > 0 ? props.scale : 1,
        width: Number.isFinite(props.width) && props.width > 0 ? props.width : undefined,
        height: Number.isFinite(props.height) && props.height > 0 ? props.height : undefined,
        color: typeof props.color === 'string' && props.color.trim() ? props.color : undefined,
        fontFamily: typeof props.fontFamily === 'string' && props.fontFamily.trim() ? props.fontFamily : undefined,
        fontSize: Number.isFinite(props.fontSize) && props.fontSize > 0 ? props.fontSize : undefined,
        background: typeof props.background === 'string' && props.background.trim() !== 'none' ? props.background : undefined,
        padding: typeof props.padding === 'string' && props.padding.trim() !== '0' ? props.padding : undefined,
        borderRadius: typeof props.borderRadius === 'string' && props.borderRadius.trim() !== '0' ? props.borderRadius : undefined,
        border: typeof props.border === 'string' && props.border.trim() !== 'none' ? props.border : undefined,
        zIndex: Number.isFinite(props.zIndex) ? props.zIndex : undefined
      };
      
      if (!safeProps.visible) {
        styles.push('display: none !important;');
      } else {
        // Constrain movement within reasonable bounds
        const constrainedX = Math.max(-100, Math.min(300, safeProps.x));
        const constrainedY = Math.max(-100, Math.min(500, safeProps.y));
        const constrainedScale = Math.max(0.1, Math.min(3, safeProps.scale));
        
        if (constrainedX !== 0 || constrainedY !== 0 || constrainedScale !== 1) {
          styles.push(`transform: translate(${constrainedX}px, ${constrainedY}px) scale(${constrainedScale}) !important;`);
          styles.push('position: relative !important;');
        }
        
        // Apply other safe properties
        if (safeProps.width) {
          const constrainedWidth = Math.min(safeProps.width, 400);
          styles.push(`width: ${constrainedWidth}px !important;`);
        }
        
        if (safeProps.height) {
          const constrainedHeight = Math.min(safeProps.height, 600);
          styles.push(`height: ${constrainedHeight}px !important;`);
        }
        
        if (safeProps.color) {
          styles.push(`color: ${safeProps.color} !important;`);
        }
        
        if (safeProps.fontFamily) {
          const fontFamily = safeProps.fontFamily === 'default' ? 'inherit' : safeProps.fontFamily;
          styles.push(`font-family: ${fontFamily} !important;`);
        }
        
        if (safeProps.fontSize) {
          const constrainedSize = Math.max(8, Math.min(48, safeProps.fontSize));
          styles.push(`font-size: ${constrainedSize}px !important;`);
        }

        if (safeProps.background) {
          styles.push(`background: ${safeProps.background} !important;`);
        }

        if (safeProps.padding) {
          styles.push(`padding: ${safeProps.padding} !important;`);
        }

        if (safeProps.borderRadius) {
          styles.push(`border-radius: ${safeProps.borderRadius} !important;`);
        }

        if (safeProps.border) {
          styles.push(`border: ${safeProps.border} !important;`);
        }

        if (safeProps.zIndex !== undefined) {
          styles.push(`z-index: ${safeProps.zIndex} !important;`);
        }
      }
      
      if (styles.length > 0) {
        transformCSS.push(`.${element} {\n  ${styles.join('\n  ')}\n}`);
      }
    });
    
    return transformCSS.join('\n\n');
  }

  private generateThemeOverrides(): string {
    return `
/* Theme 98 Overrides */
.theme-98 .profile-card-container {
  border: 2px outset #c0c0c0;
  border-radius: 0;
  background: #c0c0c0;
  color: black;
  font-family: 'MS Sans Serif', sans-serif;
}

.theme-98 .profile-banner {
  border-bottom: 1px solid #808080;
}

.theme-98 .profile-avatar {
  border: 2px inset #c0c0c0;
}

.theme-98 .profile-status {
  border: 2px outset #c0c0c0;
}

.theme-98 .profile-badge {
  background: #dfdfdf;
  border: 1px inset #c0c0c0;
}

.theme-98 .profile-username,
.theme-98 .profile-status-text {
  color: #000080;
}

.theme-98 .profile-display-name,
.theme-98 .profile-pronouns,
.theme-98 .profile-bio {
  color: black;
}
`;
  }

  // Enhanced cache statistics
  getCacheStats(): { size: number; hits: number; memory: number } {
    let totalMemory = 0;
    for (const [key, value] of this.cache.entries()) {
      totalMemory += key.length + value.css.length;
    }
    
    return {
      size: this.cache.size,
      hits: this.cache.size,
      memory: totalMemory
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.lastGeneratedHash = '';
  }
}

// Create a singleton instance
const cssGenerator = new CSSGenerator();

// Export the main function that uses the optimized generator
export const generateEasyCSS = (
  easyCustomization: EasyCustomization,
  displayNameAnimation: DisplayNameAnimation,
  rainbowSpeed: number
): string => {
  return cssGenerator.generateCSS(easyCustomization, displayNameAnimation, rainbowSpeed);
};

// Export additional utilities
export const clearCSSCache = () => cssGenerator.clearCache();
export const getCSSCacheStats = () => cssGenerator.getCacheStats();