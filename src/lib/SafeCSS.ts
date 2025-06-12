// src/lib/SafeCSS.ts

// Unified default CSS that works for both easy and custom modes
export const getDefaultProfileCSS = (): string => {
  return `
/* Clean Profile Card CSS - Works for both Easy and Custom modes */
.profile-card-container {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
  padding: 0;
  color: white;
  font-family: 'MS Sans Serif', sans-serif;
  width: 300px;
  min-height: 500px;
  position: relative;
  overflow: visible;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
}

/* Banner */
.profile-banner {
  width: 100%;
  height: 120px;
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

/* Content area */
.profile-content {
  padding: 16px;
  position: relative;
  margin-top: -30px;
  z-index: 2;
}

/* Avatar */
.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.2);
  object-fit: cover;
  background: #2f3136;
  display: block;
  margin-bottom: 12px;
  position: relative;
}

/* Status indicator */
.profile-status {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border: 2px solid white;
  border-radius: 50%;
  z-index: 3;
}

/* Badge container - horizontal scroll */
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

.profile-badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

/* Text elements without backgrounds */
.profile-display-name {
  font-size: 18px;
  font-weight: 600;
  font-family: 'MS Sans Serif', sans-serif;
  margin-bottom: 4px;
  word-wrap: break-word;
  line-height: 1.2;
  color: #ffffff;
}

.profile-username {
  font-size: 14px;
  font-family: 'MS Sans Serif', sans-serif;
  opacity: 0.8;
  margin-bottom: 4px;
  font-weight: 400;
  color: #b9bbbe;
}

.profile-pronouns {
  font-size: 12px;
  font-family: 'MS Sans Serif', sans-serif;
  opacity: 0.8;
  margin-bottom: 12px;
  display: inline-block;
  color: #dee2e6;
}

.profile-status-text {
  font-size: 12px;
  font-family: 'MS Sans Serif', sans-serif;
  opacity: 0.9;
  margin-bottom: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #b9bbbe;
}

.profile-bio {
  font-size: 14px;
  font-family: 'MS Sans Serif', sans-serif;
  line-height: 1.4;
  opacity: 0.95;
  margin-top: 12px;
  word-wrap: break-word;
  color: #dcddde;
}

.profile-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 16px 0;
  border-radius: 1px;
}

/* Theme 98 overrides */
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

/* Easy mode editing styles */
.editing-mode {
  overflow: visible !important;
}

.editing-mode .profile-content {
  overflow: visible !important;
}

.element-selected {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px !important;
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
`;
};

// CSS sanitization function
export const sanitizeCSS = (css: string): string => {
  if (!css || typeof css !== 'string') {
    return getDefaultProfileCSS();
  }

  // Remove potentially dangerous CSS
  let sanitized = css
    .replace(/@import\s+[^;]+;/gi, '') // Remove @import
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/expression\s*\(/gi, '') // Remove IE expressions
    .replace(/behavior\s*:/gi, '') // Remove IE behaviors
    .replace(/binding\s*:/gi, '') // Remove XBL bindings
    .replace(/-moz-binding\s*:/gi, '') // Remove Mozilla bindings
    .replace(/<!--/g, '') // Remove HTML comments
    .replace(/-->/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers

  // Ensure we have some CSS
  if (sanitized.trim().length < 50) {
    return getDefaultProfileCSS();
  }

  return sanitized;
};