// src/components/ProfileCustomizer/utils/cssGenerator.ts
import type { EasyCustomization, DisplayNameAnimation } from '../types';
import { getDefaultProfileCSS } from '@/lib/SafeCSS';

// Performance-optimized CSS generation with caching
class CSSGenerator {
  private cache = new Map<string, string>();
  private lastGeneratedHash = '';

  // Generate a hash for the current configuration
  private generateHash(
    easyCustomization: EasyCustomization,
    displayNameAnimation: DisplayNameAnimation,
    rainbowSpeed: number
  ): string {
    return JSON.stringify({ easyCustomization, displayNameAnimation, rainbowSpeed });
  }

  // Check if configuration has changed
  private hasConfigChanged(hash: string): boolean {
    return this.lastGeneratedHash !== hash;
  }

  generateCSS(
    easyCustomization: EasyCustomization,
    displayNameAnimation: DisplayNameAnimation,
    rainbowSpeed: number
  ): string {
    const configHash = this.generateHash(easyCustomization, displayNameAnimation, rainbowSpeed);
    
    // Return cached CSS if configuration hasn't changed
    if (!this.hasConfigChanged(configHash) && this.cache.has(configHash)) {
      return this.cache.get(configHash)!;
    }

    try {
      const css = this.buildCSS(easyCustomization, displayNameAnimation, rainbowSpeed);
      this.cache.set(configHash, css);
      this.lastGeneratedHash = configHash;
      
      // Clean up old cache entries (keep last 5)
      if (this.cache.size > 5) {
        const keysToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - 5);
        keysToDelete.forEach(key => this.cache.delete(key));
      }

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

    // Base Discord-style CSS with performance optimizations
    cssBlocks.push(`
/* Enhanced Discord-Style Profile Card with Performance Optimizations */
.profile-card-container {
  background: ${this.generateBackground(easyCustomization)};
  border-radius: ${easyCustomization.borderRadius || 16}px;
  padding: 0;
  color: white;
  font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  width: 300px;
  min-height: 600px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  /* Performance optimizations */
  contain: layout style paint;
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  
  ${this.generateShadowCSS(easyCustomization)}
  ${easyCustomization.border ? 'border: 2px solid rgba(255, 255, 255, 0.3);' : ''}
}

.profile-card-container:hover {
  transform: translateY(-4px) scale(1.02);
  ${easyCustomization.glow ? 'box-shadow: 0 0 30px rgba(102, 126, 234, 0.6), 0 20px 40px rgba(0, 0, 0, 0.35);' : 'box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);'}
}

/* Discord-style Banner with Dynamic Height */
.profile-banner {
  width: 100%;
  height: ${easyCustomization.bannerHeight || 120}px;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
  background-size: 400% 400%;
  animation: gradientFlow 12s ease-in-out infinite;
  position: relative;
  overflow: hidden;
}

@keyframes gradientFlow {
  0%, 100% { background-position: 0% 50%; }
  33% { background-position: 100% 0%; }
  66% { background-position: 0% 100%; }
}

.profile-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
  animation: shimmer 4s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

.profile-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.profile-banner:hover img {
  transform: scale(1.05);
}

/* Content Area with Dynamic Padding */
.profile-content {
  padding: ${easyCustomization.contentPadding || 16}px;
  position: relative;
  margin-top: -30px;
  z-index: 2;
}

/* Dynamic Avatar Styling */
.profile-avatar-container {
  position: relative;
  display: inline-block;
  margin-bottom: 12px;
}

.profile-avatar {
  width: ${easyCustomization.avatarSize || 80}px;
  height: ${easyCustomization.avatarSize || 80}px;
  border-radius: ${easyCustomization.avatarFrame === 'circle' ? '50%' : '12px'};
  border: 6px solid #2f3136;
  object-fit: cover;
  background: #2f3136;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.profile-avatar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.profile-avatar:hover {
  transform: scale(1.1) rotate(5deg);
  border-color: #5865f2;
  box-shadow: 0 8px 25px rgba(88, 101, 242, 0.4);
}

.profile-avatar:hover::after {
  opacity: 1;
}

/* Enhanced Status Indicator */
.profile-status {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: 4px solid #2f3136;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 3;
  animation: statusPulse 3s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

/* Enhanced Badge System */
.profile-badges {
  position: absolute;
  top: ${(easyCustomization.bannerHeight || 120) - 30}px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 3;
}

.profile-badge {
  width: 28px;
  height: 28px;
  background: rgba(47, 49, 54, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  padding: 2px;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.profile-badge::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(45deg, transparent, rgba(88, 101, 242, 0.2), transparent);
  border-radius: inherit;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.profile-badge:hover {
  transform: scale(1.25) rotate(10deg);
  border-color: #5865f2;
  box-shadow: 0 4px 15px rgba(88, 101, 242, 0.5);
}

.profile-badge:hover::before {
  opacity: 1;
}

.profile-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  transition: transform 0.3s ease;
}

.profile-badge:hover img {
  transform: scale(1.1);
}

/* Enhanced Typography with Dynamic Font */
.profile-display-name {
  font-size: ${Math.max(18, (easyCustomization.fontSize || 16) + 6)}px;
  font-weight: ${easyCustomization.textBold ? '700' : '600'};
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  margin-bottom: 4px;
  word-wrap: break-word;
  line-height: 1.2;
  cursor: text;
  transition: all 0.3s ease;
  
  ${this.generateTextEffects(easyCustomization)}
}

.profile-username {
  font-size: ${Math.max(12, (easyCustomization.fontSize || 16) - 2)}px;
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  opacity: 0.8;
  margin-bottom: 4px;
  font-weight: 400;
  color: #b9bbbe;
  transition: color 0.3s ease;
}

.profile-username:hover {
  color: #dcddde;
}

.profile-pronouns {
  font-size: ${Math.max(10, (easyCustomization.fontSize || 16) - 4)}px;
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  opacity: 0.8;
  margin-bottom: 12px;
  background: rgba(88, 101, 242, 0.2);
  padding: 4px 8px;
  border-radius: 10px;
  display: inline-block;
  color: #dee2e6;
  border: 1px solid rgba(88, 101, 242, 0.3);
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.profile-pronouns:hover {
  background: rgba(88, 101, 242, 0.3);
  transform: translateY(-1px);
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
  transition: color 0.3s ease;
}

.profile-status-text:hover {
  color: #dcddde;
}

.profile-bio {
  font-size: ${Math.max(12, (easyCustomization.fontSize || 16) - 2)}px;
  font-family: ${easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily};
  line-height: 1.4;
  opacity: 0.95;
  margin-top: 12px;
  word-wrap: break-word;
  background: rgba(47, 49, 54, 0.6);
  padding: 12px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #dcddde;
  transition: all 0.3s ease;
}

.profile-bio:hover {
  background: rgba(47, 49, 54, 0.8);
  transform: translateY(-1px);
}

.profile-divider {
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  margin: 16px 0;
  border-radius: 1px;
}

/* Activity Status Section */
.profile-activity {
  background: rgba(47, 49, 54, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
  transition: all 0.3s ease;
}

.profile-activity:hover {
  background: rgba(47, 49, 54, 0.9);
  transform: translateY(-1px);
}

.profile-member-since {
  background: rgba(47, 49, 54, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
  transition: all 0.3s ease;
}

.profile-member-since:hover {
  background: rgba(47, 49, 54, 0.9);
  transform: translateY(-1px);
}
`);

    // Enhanced display name animations
    cssBlocks.push(this.generateDisplayNameAnimations(displayNameAnimation, rainbowSpeed));

    // Element positioning and transformations
    cssBlocks.push(this.generateElementTransforms(easyCustomization.elements));

    // Theme-specific overrides
    cssBlocks.push(this.generateThemeOverrides());

    // Performance optimizations
    cssBlocks.push(`
/* Performance Optimizations */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* GPU Acceleration */
.profile-card-container,
.profile-banner,
.profile-avatar,
.profile-badge {
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Smooth scrolling */
.profile-content {
  scroll-behavior: smooth;
}

/* Optimized for mobile */
@media (max-width: 480px) {
  .profile-card-container {
    width: 280px;
    min-height: 500px;
  }
  
  .profile-avatar {
    width: ${Math.max(60, (easyCustomization.avatarSize || 80) - 20)}px;
    height: ${Math.max(60, (easyCustomization.avatarSize || 80) - 20)}px;
  }
  
  .profile-banner {
    height: ${Math.max(80, (easyCustomization.bannerHeight || 120) - 40)}px;
  }
}
`);

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
/* Enhanced Display Name Animations */
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
  background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #00f2fe);
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
    filter: brightness(1);
  }
  to { 
    text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor;
    filter: brightness(1.2);
  }
}
`;
  }

  private generateElementTransforms(elements: EasyCustomization['elements']): string {
    if (!elements || typeof elements !== 'object') return '';
    
    const transformCSS: string[] = [];
    
    Object.entries(elements).forEach(([element, props]) => {
      if (!props || typeof props !== 'object') return;
      
      const styles: string[] = [];
      
      if (props.visible === false) {
        styles.push('display: none !important;');
      } else {
        const x = typeof props.x === 'number' ? props.x : 0;
        const y = typeof props.y === 'number' ? props.y : 0;
        const scale = typeof props.scale === 'number' ? props.scale : 1;
        
        if (x !== 0 || y !== 0 || scale !== 1) {
          styles.push(`transform: translate(${x}px, ${y}px) scale(${scale}) !important;`);
          styles.push('position: relative !important;');
        }
        
        if (typeof props.width === 'number') {
          styles.push(`width: ${props.width}px !important;`);
        }
        
        if (typeof props.height === 'number') {
          styles.push(`height: ${props.height}px !important;`);
        }
        
        if (props.color && typeof props.color === 'string') {
          styles.push(`color: ${props.color} !important;`);
        }
        
        if (props.fontFamily && typeof props.fontFamily === 'string') {
          const fontFamily = props.fontFamily === 'default' ? 'inherit' : props.fontFamily;
          styles.push(`font-family: ${fontFamily} !important;`);
        }
        
        if (typeof props.fontSize === 'number') {
          styles.push(`font-size: ${props.fontSize}px !important;`);
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
  box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px grey, inset 2px 2px #fff;
  background: #c0c0c0;
  color: black;
  font-family: 'MS Sans Serif', sans-serif;
}

.theme-98 .profile-banner {
  border-bottom: 1px solid #808080;
  background: linear-gradient(45deg, #008080, #0000ff, #800080, #ff0000);
}

.theme-98 .profile-avatar {
  border: 2px inset #c0c0c0;
  box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf;
}

.theme-98 .profile-status {
  border: 2px outset #c0c0c0;
}

.theme-98 .profile-badge {
  background: #dfdfdf;
  border: 1px inset #c0c0c0;
}

.theme-98 .profile-pronouns,
.theme-98 .profile-bio,
.theme-98 .profile-activity,
.theme-98 .profile-member-since {
  background: #dfdfdf;
  border: 1px inset #c0c0c0;
  color: black;
}

.theme-98 .profile-username,
.theme-98 .profile-status-text {
  color: #000080;
}

/* Dark theme overrides */
@media (prefers-color-scheme: dark) {
  .profile-card-container:not(.theme-98) {
    background: linear-gradient(135deg, #2c2f36, #1e1f24);
    color: #e0e0e0;
  }
}
`;
  }

  // Clear cache (useful for testing or memory management)
  clearCache(): void {
    this.cache.clear();
    this.lastGeneratedHash = '';
  }

  // Get cache statistics
  getCacheStats(): { size: number; hits: number } {
    return {
      size: this.cache.size,
      hits: this.cache.size // Simplified metric
    };
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