// src/app/chat/utils/chatHelpers.ts
import { toast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'partner' | 'system';
  timestamp: Date;
  senderUsername?: string;
  senderAuthId?: string;
  senderDisplayNameColor?: string;
  senderDisplayNameAnimation?: string;
  senderRainbowSpeed?: number;
}

export interface PartnerInfo {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  pronouns?: string;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  displayNameColor?: string;
  displayNameAnimation?: string;
  rainbowSpeed?: number;
  authId?: string;
  badges?: any[];
}

export interface EmoteData {
  filename: string;
  width?: number;
  height?: number;
}

// Render message with emoji support
export const renderMessageWithEmojis = (
  text: string, 
  emojiFilenames: string[], 
  baseUrl: string
): (string | JSX.Element)[] => {
  if (!emojiFilenames || emojiFilenames.length === 0) {
    return [text];
  }

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  const regex = /:([a-zA-Z0-9_.-]+?):/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const shortcodeName = match[1];
    const matchedFilename = emojiFilenames.find(
      (filename) => filename.split('.')[0].toLowerCase() === shortcodeName.toLowerCase()
    );

    if (matchedFilename) {
      parts.push(
        <img
          key={`${match.index}-${shortcodeName}`}
          src={`${baseUrl}${matchedFilename}`}
          alt={shortcodeName}
          className="inline max-h-5 w-auto mx-0.5 align-middle"
          data-ai-hint="chat emoji"
        />
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

// Get display name CSS class for animations
export const getDisplayNameClass = (animation?: string) => {
  switch (animation) {
    case 'rainbow':
      return 'display-name-rainbow';
    case 'gradient':
      return 'display-name-gradient';
    case 'pulse':
      return 'display-name-pulse';
    case 'glow':
      return 'display-name-glow';
    default:
      return '';
  }
};

// Favicon management
export const changeFavicon = (newFaviconHref: string, removeOld: boolean = false) => {
  if (typeof window === 'undefined' || !document.head) {
    console.warn('Cannot change favicon, window or document.head not available.');
    return;
  }
  
  let existingLink: HTMLLinkElement | null = document.head.querySelector("link[rel*='icon']");
  
  if (removeOld && existingLink && existingLink.parentNode) {
    existingLink.parentNode.removeChild(existingLink);
    existingLink = null;
  }
  
  if (!existingLink) {
    existingLink = document.createElement('link');
    existingLink.type = 'image/x-icon';
    existingLink.rel = 'shortcut icon';
    document.head.appendChild(existingLink);
  }
  
  existingLink.href = newFaviconHref;
};

// Sound utility
export const playSound = (filename: string) => {
  try {
    const audio = new Audio(`/sounds/${filename}`);
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.warn('Could not play sound:', err);
    });
  } catch (err) {
    console.warn('Error creating audio:', err);
  }
};

// Message validation
export const validateMessage = (message: string): { valid: boolean; error?: string } => {
  const trimmed = message.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (trimmed.length > 2000) {
    return { valid: false, error: 'Message too long (max 2000 characters)' };
  }
  
  return { valid: true };
};

// Connection state helpers
export const getConnectionStatusText = (
  isSocketConnected: boolean,
  isPartnerConnected: boolean,
  isFindingPartner: boolean,
  socketError: boolean
): string => {
  if (socketError) return 'Connection Error';
  if (!isSocketConnected) return 'Connecting...';
  if (isPartnerConnected) return 'Connected';
  if (isFindingPartner) return 'Searching...';
  return 'Ready';
};

// Toast helpers for common chat notifications
export const showChatToast = {
  connectionError: (error: string) => {
    toast({
      title: "Connection Error",
      description: error,
      variant: "destructive"
    });
  },
  
  partnerFound: () => {
    toast({
      title: "Partner Found!",
      description: "You can now start chatting",
      variant: "default"
    });
  },
  
  partnerLeft: () => {
    toast({
      title: "Partner Disconnected",
      description: "Your chat partner has left",
      variant: "default"
    });
  },
  
  messageError: (error: string) => {
    toast({
      title: "Message Error",
      description: error,
      variant: "destructive"
    });
  },
  
  cooldown: () => {
    toast({
      title: "Please Wait",
      description: "You're searching too fast. Please wait a moment.",
      variant: "default"
    });
  }
};

// Local storage helpers for chat preferences
export const ChatPreferences = {
  save: (preferences: any) => {
    try {
      localStorage.setItem('tinchat-preferences', JSON.stringify(preferences));
    } catch (err) {
      console.warn('Could not save preferences:', err);
    }
  },
  
  load: () => {
    try {
      const saved = localStorage.getItem('tinchat-preferences');
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.warn('Could not load preferences:', err);
      return {};
    }
  },
  
  clear: () => {
    try {
      localStorage.removeItem('tinchat-preferences');
    } catch (err) {
      console.warn('Could not clear preferences:', err);
    }
  }
};

// Enhanced input handling for mobile
export const setupMobileInputHandling = (inputRef: React.RefObject<HTMLInputElement>) => {
  if (!inputRef.current || typeof window === 'undefined') return;
  
  const input = inputRef.current;
  
  // Prevent zoom on iOS
  if (input.style) {
    input.style.fontSize = '16px';
  }
  
  // Handle virtual keyboard
  const handleFocus = () => {
    // Scroll to input when keyboard opens
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };
  
  const handleBlur = () => {
    // Reset scroll when keyboard closes
    window.scrollTo(0, 0);
  };
  
  input.addEventListener('focus', handleFocus);
  input.addEventListener('blur', handleBlur);
  
  return () => {
    input.removeEventListener('focus', handleFocus);
    input.removeEventListener('blur', handleBlur);
  };
};