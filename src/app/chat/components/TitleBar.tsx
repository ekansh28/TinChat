import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface TitleBarProps {
  isConnected: boolean;
  isPartnerConnected: boolean;
  partnerInfo?: {
    username: string;
    avatar: string;
    displayName?: string;
  };
  partnerStatus: string;
  theme?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({
  isConnected,
  isPartnerConnected,
  partnerInfo,
  partnerStatus,
  theme = 'theme-98'
}) => {
  // Check if Windows 7 theme is active (same logic as other components)
  const [isWindows7Theme, setIsWindows7Theme] = useState(false);
  
  const checkWindows7Theme = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    // Check if Windows 7 CSS is loaded (same ID as TopBar uses)
    const win7Link = document.getElementById('win7-css-link') as HTMLLinkElement;
    const hasWin7CSS = win7Link && win7Link.href.includes('7.css');
    
    // Check for Windows 7 sub-theme CSS links (from /win7themes/ folder)
    const win7SubThemeLink = document.querySelector('link[href*="/win7themes/"]') as HTMLLinkElement;
    const hasWin7SubTheme = win7SubThemeLink !== null;
    
    return hasWin7CSS || hasWin7SubTheme;
  }, []);
  
  // Update Windows 7 theme state
  useEffect(() => {
    const updateThemeState = () => {
      const newWin7State = checkWindows7Theme();
      setIsWindows7Theme(newWin7State);
    };
    
    updateThemeState();
    
    const headObserver = new MutationObserver((mutations) => {
      const linkMutation = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
        ) ||
        Array.from(mutation.removedNodes).some(node => 
          node.nodeName === 'LINK' || (node as Element)?.id === 'win7-css-link'
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
  }, [checkWindows7Theme]);

  // Function to add glass active classes to parent window
  useEffect(() => {
    if (isWindows7Theme) {
      // Find the parent window element and add glass active classes
      const windowElement = document.querySelector('.window');
      if (windowElement) {
        if (!windowElement.classList.contains('glass')) {
          windowElement.classList.add('glass');
        }
        if (!windowElement.classList.contains('active')) {
          windowElement.classList.add('active');
        }
        console.log("TitleBar: Added glass active classes to window");
      }
    } else {
      // Remove glass class when not Windows 7 theme
      const windowElement = document.querySelector('.window.glass');
      if (windowElement) {
        windowElement.classList.remove('glass');
        windowElement.classList.remove('active');
        console.log("TitleBar: Removed glass active classes from window");
      }
    }
  }, [isWindows7Theme]);

  const avatarUrl = partnerInfo?.avatar || '/default-avatar.png';
  const username = partnerInfo?.displayName || partnerInfo?.username || 'Stranger';

  // Determine the connection status text
  const getStatusText = () => {
    if (!isConnected) {
      return 'Connecting...';
    }
    if (!isPartnerConnected) {
      return 'Waiting for partner...';
    }
    return partnerStatus || 'Connected';
  };

  // Determine the window title
  const getWindowTitle = () => {
    if (isPartnerConnected && partnerInfo) {
      return `Chat with ${username}`;
    }
    return 'Anonymous Chat';
  };

  return (
    <div className={cn(
      "title-bar",
      isWindows7Theme && "glass-title-bar"
    )}>
      <div className="title-bar-text flex items-center gap-2">
        {/* Chat icon */}
        <span className="text-sm">💬</span>
        
        {/* Window title */}
        <span className="font-medium">
          {getWindowTitle()}
        </span>
        
        {/* Connection status */}
        <span className={cn(
          "text-xs ml-auto",
          isWindows7Theme ? "text-gray-700" : "text-gray-600"
        )}>
          {getStatusText()}
        </span>
      </div>
      
      <div className="title-bar-controls">
        <button aria-label="Minimize"></button>
        <button aria-label="Maximize"></button>
        <button aria-label="Close"></button>
      </div>
    </div>
  );
};

export default TitleBar;