// src/components/ProfileCustomizer/utils/cssGenerator.ts
import type { EasyCustomization, DisplayNameAnimation } from '../types';

export const generateEasyCSS = (
  easyCustomization: EasyCustomization,
  displayNameAnimation: DisplayNameAnimation,
  rainbowSpeed: number
): string => {
  let css = `
/* Enhanced Profile Card Styles */
.profile-card-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 0;
  color: white;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  width: 350px;
  min-height: 500px;
  position: relative;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.profile-card-container:hover {
  transform: translateY(-5px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.profile-banner {
  width: 100%;
  height: 140px;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
  background-size: 400% 400%;
  animation: gradientShift 8s ease-in-out infinite;
  position: relative;
  overflow: hidden;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.profile-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-content {
  padding: 24px;
  position: relative;
  margin-top: -50px;
  z-index: 2;
}

.profile-avatar-container {
  position: relative;
  display: inline-block;
  margin-bottom: 16px;
}

.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 6px solid white;
  object-fit: cover;
  background: #ffffff;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.profile-avatar:hover {
  transform: scale(1.05);
}

.profile-status {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: 4px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  z-index: 3;
}

.profile-badges {
  position: absolute;
  top: 140px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 3;
}

.profile-badge {
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 2px;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.profile-badge:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.profile-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.profile-display-name {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 8px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  word-wrap: break-word;
  line-height: 1.2;
}

.profile-username {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 8px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.profile-pronouns {
  font-size: 14px;
  opacity: 0.8;
  margin-bottom: 16px;
  font-style: italic;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
  display: inline-block;
}

.profile-status-text {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.profile-bio {
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.95;
  margin-top: 16px;
  word-wrap: break-word;
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.profile-divider {
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  margin: 20px 0;
}

/* Display name animations */
.display-name-rainbow {
  background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow 3s ease-in-out infinite;
}

@keyframes rainbow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.display-name-gradient {
  background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 4s ease-in-out infinite;
}

.display-name-pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.display-name-glow {
  text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from { text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor; }
  to { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
}

/* Theme 98 specific styles */
.theme-98 .profile-card-container {
  border: 2px outset #c0c0c0;
  border-radius: 0;
  box-shadow: inset -1px -1px #0a0a0a, inset 1px 1px #dfdfdf, inset -2px -2px grey, inset 2px 2px #fff;
  background: #c0c0c0;
  color: black;
}

.theme-98 .profile-banner {
  border-bottom: 1px solid #808080;
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

.theme-98 .profile-pronouns {
  background: #dfdfdf;
  border: 1px inset #c0c0c0;
  color: black;
}

.theme-98 .profile-bio {
  background: #dfdfdf;
  border: 1px inset #c0c0c0;
  color: black;
}
`;
  
  // Background
  if (easyCustomization.backgroundGradient?.enabled) {
    const direction = easyCustomization.backgroundGradient.direction === 'radial' 
      ? 'radial-gradient(circle' 
      : `linear-gradient(${easyCustomization.backgroundGradient.direction}`;
    css += `.profile-card-container {
      background: ${direction}, ${easyCustomization.backgroundGradient.color1}, ${easyCustomization.backgroundGradient.color2});
    }\n`;
  } else {
    css += `.profile-card-container {
      background: ${easyCustomization.backgroundColor};
    }\n`;
  }
  
  // Border radius
  css += `.profile-card-container {
    border-radius: ${easyCustomization.borderRadius}px;
  }\n`;
  
  // Shadow and effects
  let boxShadow = '';
  if (easyCustomization.shadow) {
    boxShadow += '0 15px 35px rgba(0, 0, 0, 0.3)';
  }
  if (easyCustomization.glow) {
    if (boxShadow) boxShadow += ', ';
    boxShadow += '0 0 20px rgba(102, 126, 234, 0.5)';
  }
  if (boxShadow) {
    css += `.profile-card-container {
      box-shadow: ${boxShadow};
    }\n`;
  }
  
  // Border
  if (easyCustomization.border) {
    css += `.profile-card-container {
      border: 2px solid rgba(255, 255, 255, 0.3);
    }\n`;
  }
  
  // Banner height
  css += `.profile-banner {
    height: ${easyCustomization.bannerHeight}px;
  }\n`;
  
  // Avatar size and frame
  css += `.profile-avatar {
    width: ${easyCustomization.avatarSize}px;
    height: ${easyCustomization.avatarSize}px;
    border-radius: ${easyCustomization.avatarFrame === 'circle' ? '50%' : '8px'};
  }\n`;
  
  // Content padding
  css += `.profile-content {
    padding: ${easyCustomization.contentPadding}px;
  }\n`;
  
  // Typography
  const fontFamily = easyCustomization.fontFamily === 'default' ? 'inherit' : easyCustomization.fontFamily;
  css += `.profile-card-container {
    font-family: ${fontFamily};
    font-size: ${easyCustomization.fontSize}px;
  }\n`;
  
  // Text effects
  let textShadow = '';
  if (easyCustomization.textShadow) {
    textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
  }
  if (easyCustomization.textGlow) {
    if (textShadow) textShadow += ', ';
    textShadow += '0 0 10px currentColor';
  }
  if (textShadow) {
    css += `.profile-display-name, .profile-username, .profile-bio {
      text-shadow: ${textShadow};
    }\n`;
  }
  
  if (easyCustomization.textBold) {
    css += `.profile-display-name, .profile-username, .profile-bio {
      font-weight: bold;
    }\n`;
  }
  
  // Rainbow speed
  if (displayNameAnimation === 'rainbow') {
    css += `@keyframes rainbow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .display-name-rainbow {
      animation: rainbow ${rainbowSpeed}s ease-in-out infinite;
    }\n`;
  }
  
  // Element positions and scales
  Object.entries(easyCustomization.elements).forEach(([element, props]) => {
    if (!props.visible) {
      css += `.${element} {
        display: none;
      }\n`;
    } else {
      let transform = `translate(${props.x}px, ${props.y}px) scale(${props.scale})`;
      css += `.${element} {
        transform: ${transform};
        position: relative;
      }\n`;
      
      if (props.width) {
        css += `.${element} {
          width: ${props.width}px;
        }\n`;
      }
      
      if (props.height) {
        css += `.${element} {
          height: ${props.height}px;
        }\n`;
      }
      
      if (props.color) {
        css += `.${element} {
          color: ${props.color} !important;
        }\n`;
      }
    }
  });
  
  return css;
};