// src/app/chat/utils/ChatHelpers.tsx - Updated with Enhanced Audio Support
import React from 'react';
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
  avatar_url?: string;
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

// CDN Configuration
const EMOJI_CDN_BASE = "https://cdn.tinchat.online/emotes/";

// Cache for loaded emote data
let emoteCache: string[] | null = null;
let emoteLoadPromise: Promise<string[]> | null = null;

// ✅ NEW: Enhanced Audio Management with User Interaction Detection
interface AudioConfig {
  volume: number; // 0-1 range
  enabled: boolean;
}

// ✅ NEW: User interaction tracking
let userHasInteracted = false;
let pendingSounds: (() => void)[] = [];

// ✅ NEW: Detect user interaction
const detectUserInteraction = () => {
  if (!userHasInteracted) {
    userHasInteracted = true;
    console.log('[ChatHelpers] User interaction detected, enabling audio');
    
    // Play any pending sounds
    pendingSounds.forEach(playFn => {
      try {
        playFn();
      } catch (error) {
        console.warn('[ChatHelpers] Failed to play pending sound:', error);
      }
    });
    pendingSounds = [];
    
    // Remove listeners after first interaction
    document.removeEventListener('click', detectUserInteraction);
    document.removeEventListener('keydown', detectUserInteraction);
    document.removeEventListener('touchstart', detectUserInteraction);
  }
};

// ✅ NEW: Setup interaction listeners
const setupInteractionListeners = () => {
  if (typeof window !== 'undefined' && !userHasInteracted) {
    document.addEventListener('click', detectUserInteraction, { once: true });
    document.addEventListener('keydown', detectUserInteraction, { once: true });
    document.addEventListener('touchstart', detectUserInteraction, { once: true });
    console.log('[ChatHelpers] Waiting for user interaction to enable audio');
  }
};

// ✅ NEW: Audio cache for better performance
const audioCache = new Map<string, HTMLAudioElement>();
let globalAudioConfig: AudioConfig = {
  volume: 0.5, // Default 50%
  enabled: true
};

// ✅ NEW: Audio preloading for message sounds
export const preloadMessageSounds = (): void => {
  const soundFiles = [
    '/sounds/message/imrcv.wav',
    '/sounds/message/imsend.mp3',
    '/sounds/Match.wav'
  ];

  soundFiles.forEach(src => {
    try {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = 0; // Silent preload
      audioCache.set(src, audio);
      console.log('[ChatHelpers] Preloaded audio:', src);
    } catch (error) {
      console.warn('[ChatHelpers] Failed to preload audio:', src, error);
    }
  });
};

// ✅ NEW: Get cached audio element
const getCachedAudio = (src: string): HTMLAudioElement => {
  if (!audioCache.has(src)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioCache.set(src, audio);
  }
  return audioCache.get(src)!;
};

// ✅ ENHANCED: Play sound with user interaction check
export const playSound = (filename: string, volume?: number): void => {
  if (!globalAudioConfig.enabled) {
    console.log('[ChatHelpers] Audio disabled, skipping sound:', filename);
    return;
  }

  const playSoundFn = () => {
    try {
      const src = filename.startsWith('/') ? filename : `/sounds/${filename}`;
      const audio = getCachedAudio(src);
      
      // Use provided volume or global config
      audio.volume = volume !== undefined ? volume : globalAudioConfig.volume;
      audio.currentTime = 0; // Reset to start
      
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(err => {
          console.warn('[ChatHelpers] Could not play sound:', err);
        });
      }
    } catch (err) {
      console.warn('[ChatHelpers] Error playing sound:', err);
    }
  };

  // ✅ NEW: Check for user interaction
  if (!userHasInteracted) {
    console.log('[ChatHelpers] Queueing sound until user interaction:', filename);
    pendingSounds.push(playSoundFn);
    setupInteractionListeners();
    
    // Show helpful message for first sound
    if (pendingSounds.length === 1) {
      setTimeout(() => {
        if (!userHasInteracted && typeof window !== 'undefined') {
          showChatToast.audioWaitingForInteraction();
        }
      }, 1000);
    }
    return;
  }

  playSoundFn();
};

// ✅ NEW: Message-specific sound functions
export const playMessageReceivedSound = (volume?: number): void => {
  playSound('/sounds/message/imrcv.wav', volume);
};

export const playMessageSentSound = (volume?: number): void => {
  playSound('/sounds/message/imsend.mp3', volume);
};

export const playMatchSound = (volume?: number): void => {
  playSound('/sounds/Match.wav', volume);
};

// ✅ NEW: Audio configuration functions
export const setGlobalAudioVolume = (volume: number): void => {
  globalAudioConfig.volume = Math.max(0, Math.min(1, volume));
  console.log('[ChatHelpers] Set global audio volume to:', globalAudioConfig.volume);
};

export const setGlobalAudioEnabled = (enabled: boolean): void => {
  globalAudioConfig.enabled = enabled;
  console.log('[ChatHelpers] Audio enabled:', enabled);
};

export const getGlobalAudioConfig = (): AudioConfig => {
  return { ...globalAudioConfig };
};

// ✅ NEW: Convert taskbar volume (0-3) to audio volume (0-1)
export const taskbarVolumeToAudioVolume = (taskbarLevel: number): number => {
  if (taskbarLevel === 0) return 0; // Muted
  return taskbarLevel / 3; // Convert 1-3 to 0.33-1.0
};

// ✅ NEW: Manual interaction trigger (for testing or manual enabling)
export const enableAudioAfterInteraction = (): void => {
  if (!userHasInteracted) {
    detectUserInteraction();
  }
};

// ✅ NEW: Check if user has interacted
export const hasUserInteracted = (): boolean => {
  return userHasInteracted;
};

// ✅ NEW: Get pending sounds count (for debugging)
export const getPendingSoundsCount = (): number => {
  return pendingSounds.length;
};

// Load emote list from CDN
const loadEmoteList = async (): Promise<string[]> => {
  if (emoteCache) {
    return emoteCache;
  }

  if (emoteLoadPromise) {
    return emoteLoadPromise;
  }

  emoteLoadPromise = (async () => {
    try {
      console.log('[ChatHelpers] Loading emote list from CDN');
      const response = await fetch('/emote_index.json');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: EmoteData[] = await response.json();
      const filenames = data.map(emote => emote.filename);
      
      emoteCache = filenames;
      console.log('[ChatHelpers] Loaded', filenames.length, 'emotes from CDN');
      
      return filenames;
    } catch (error) {
      console.error('[ChatHelpers] Failed to load emotes:', error);
      emoteCache = []; // Cache empty array to prevent repeated failures
      return [];
    }
  })();

  return emoteLoadPromise;
};

// Render message with emoji support using CDN
export const renderMessageWithEmojis = (
  text: string, 
  emojiFilenames: string[], 
  baseUrl: string
): (string | React.ReactElement)[] => {
  if (!emojiFilenames || emojiFilenames.length === 0) {
    return [text];
  }

  const parts: (string | React.ReactElement)[] = [];
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
        React.createElement('img', {
          key: `${match.index}-${shortcodeName}`,
          src: `${EMOJI_CDN_BASE}${matchedFilename}`, // Use CDN URL
          alt: shortcodeName,
          className: "inline max-h-5 w-auto mx-0.5 align-middle",
          'data-ai-hint': "chat emoji",
          loading: "lazy",
          onError: (e: React.SyntheticEvent<HTMLImageElement>) => {
            const img = e.currentTarget;
            img.style.display = 'none';
            console.warn('[ChatHelpers] Failed to load emoji:', matchedFilename);
          }
        })
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

// Enhanced render function that loads emotes automatically
export const renderMessageWithEmojisAsync = async (
  text: string
): Promise<(string | React.ReactElement)[]> => {
  try {
    const emojiFilenames = await loadEmoteList();
    return renderMessageWithEmojis(text, emojiFilenames, EMOJI_CDN_BASE);
  } catch (error) {
    console.error('[ChatHelpers] Error rendering emojis:', error);
    return [text]; // Return plain text on error
  }
};

// Get display name CSS class for animations
export const getDisplayNameClass = (animation?: string): string => {
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
export const changeFavicon = (newFaviconHref: string, removeOld: boolean = false): void => {
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

// ✅ ENHANCED: Toast helpers with audio integration
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
    });
    // ✅ FIXED: Use enhanced audio function
    playMatchSound();
  },
  
  partnerLeft: () => {
    toast({
      title: "Partner Disconnected",
      description: "Your chat partner has left",
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
    });
  },

  // ✅ NEW: Audio-related toasts with interaction messages
  volumeChanged: (level: number) => {
    toast({
      title: "Volume Changed",
      description: level === 0 ? "Message sounds muted" : `Message volume: ${Math.round((level / 3) * 100)}%`,
    });
  },

  audioError: (error: string) => {
    toast({
      title: "Audio Error",
      description: error,
      variant: "destructive"
    });
  },

  audioWaitingForInteraction: () => {
    toast({
      title: "Audio Ready",
      description: "Click anywhere to enable message sounds",
    });
  },

  audioPendingSounds: (count: number) => {
    toast({
      title: "Sounds Queued",
      description: `${count} sound${count !== 1 ? 's' : ''} will play after you interact with the page`,
    });
  }
};

// Local storage helpers for chat preferences (including audio)
export const ChatPreferences = {
  save: (preferences: any): void => {
    try {
      localStorage.setItem('tinchat-preferences', JSON.stringify(preferences));
    } catch (err) {
      console.warn('Could not save preferences:', err);
    }
  },
  
  load: (): any => {
    try {
      const saved = localStorage.getItem('tinchat-preferences');
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.warn('Could not load preferences:', err);
      return {};
    }
  },
  
  clear: (): void => {
    try {
      localStorage.removeItem('tinchat-preferences');
    } catch (err) {
      console.warn('Could not clear preferences:', err);
    }
  },

  // ✅ NEW: Audio-specific preference helpers
  getAudioVolume: (): number => {
    const prefs = ChatPreferences.load();
    return prefs.audioVolume !== undefined ? prefs.audioVolume : 2; // Default to level 2
  },

  setAudioVolume: (volume: number): void => {
    const prefs = ChatPreferences.load();
    prefs.audioVolume = volume;
    ChatPreferences.save(prefs);
  },

  getAudioEnabled: (): boolean => {
    const prefs = ChatPreferences.load();
    return prefs.audioEnabled !== undefined ? prefs.audioEnabled : true; // Default enabled
  },

  setAudioEnabled: (enabled: boolean): void => {
    const prefs = ChatPreferences.load();
    prefs.audioEnabled = enabled;
    ChatPreferences.save(prefs);
  }
};

// Enhanced input handling for mobile
export const setupMobileInputHandling = (inputRef: React.RefObject<HTMLInputElement>): (() => void) | undefined => {
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

// Status configuration for partner status display
export const STATUS_CONFIG = {
  online: { icon: '/icons/online.png', color: '#43b581', text: 'Online' },
  idle: { icon: '/icons/idle.png', color: '#faa61a', text: 'Idle' },
  dnd: { icon: '/icons/dnd.png', color: '#f04747', text: 'Do Not Disturb' },
  offline: { icon: '/icons/offline.png', color: '#747f8d', text: 'Offline' }
} as const;

// Utility to filter system messages for advanced message management
export const filterSystemMessagesFrom = (msgs: Message[], textPattern: string): Message[] => 
  msgs.filter(msg => !(msg.sender === 'system' && msg.text.toLowerCase().includes(textPattern.toLowerCase())));

// Utility to add system message if not already present
export const addSystemMessageIfNotPresentIn = (msgs: Message[], text: string, idSuffix: string): Message[] => {
  const lowerText = text.toLowerCase();
  if (!msgs.some(msg => msg.sender === 'system' && msg.text.toLowerCase().includes(lowerText))) {
    return [...msgs, { 
      id: `${Date.now()}-${idSuffix}`, 
      text, 
      sender: 'system', 
      timestamp: new Date() 
    }];
  }
  return msgs;
};

// Typing indicator utilities
export const createTypingTimeout = (callback: () => void, delay: number = 2000): NodeJS.Timeout => {
  return setTimeout(callback, delay);
};

export const clearTypingTimeout = (timeout: NodeJS.Timeout | null): void => {
  if (timeout) {
    clearTimeout(timeout);
  }
};

// Mobile viewport utilities
export const getMobileViewportHeight = (): number => {
  if (typeof window !== 'undefined') {
    return window.visualViewport?.height || window.innerHeight;
  }
  return 0;
};

export const isMobileDevice = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768;
  }
  return false;
};

// Scroll utilities
export const scrollToBottom = (container: HTMLElement | null, force: boolean = false): void => {
  if (!container) return;
  
  const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
  
  if (force || isAtBottom) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
};

// CDN Emoji utilities
export const getRandomEmoji = async (): Promise<string> => {
  try {
    const emojiFilenames = await loadEmoteList();
    if (emojiFilenames.length === 0) return '';
    const randomIndex = Math.floor(Math.random() * emojiFilenames.length);
    return `${EMOJI_CDN_BASE}${emojiFilenames[randomIndex]}`;
  } catch (error) {
    console.warn('Failed to get random emoji:', error);
    return '';
  }
};

export const createEmojiCycleInterval = async (
  callback: (url: string) => void,
  intervalMs: number = 300
): Promise<NodeJS.Timeout | null> => {
  try {
    const emojiFilenames = await loadEmoteList();
    if (emojiFilenames.length === 0) return null;
    
    return setInterval(() => {
      const randomIndex = Math.floor(Math.random() * emojiFilenames.length);
      const randomUrl = `${EMOJI_CDN_BASE}${emojiFilenames[randomIndex]}`;
      callback(randomUrl);
    }, intervalMs);
  } catch (error) {
    console.warn('Failed to create emoji cycle:', error);
    return null;
  }
};

// Preload popular emojis for better performance
export const preloadPopularEmojis = async (): Promise<void> => {
  try {
    const emojiFilenames = await loadEmoteList();
    const popularEmojis = emojiFilenames.slice(0, 20); // Preload first 20 emojis
    
    popularEmojis.forEach(filename => {
      const img = new Image();
      img.src = `${EMOJI_CDN_BASE}${filename}`;
    });
    
    console.log('[ChatHelpers] Preloaded', popularEmojis.length, 'popular emojis');
  } catch (error) {
    console.warn('[ChatHelpers] Failed to preload emojis:', error);
  }
};

// Get emoji suggestions based on text
export const getEmojiSuggestions = async (text: string): Promise<string[]> => {
  try {
    const emojiFilenames = await loadEmoteList();
    const lowercaseText = text.toLowerCase();
    
    const suggestions = emojiFilenames
      .filter(filename => {
        const name = filename.split('.')[0].toLowerCase();
        return name.includes(lowercaseText);
      })
      .slice(0, 5); // Limit to 5 suggestions
    
    return suggestions;
  } catch (error) {
    console.warn('Failed to get emoji suggestions:', error);
    return [];
  }
};

// ✅ NEW: Initialize audio system with interaction detection
export const initializeAudioSystem = (): void => {
  // Load preferences
  const volume = ChatPreferences.getAudioVolume();
  const enabled = ChatPreferences.getAudioEnabled();
  
  // Apply settings
  setGlobalAudioVolume(taskbarVolumeToAudioVolume(volume));
  setGlobalAudioEnabled(enabled);
  
  // Setup user interaction detection
  setupInteractionListeners();
  
  // Preload sounds
  preloadMessageSounds();
  
  console.log('[ChatHelpers] Audio system initialized - Volume:', volume, 'Enabled:', enabled);
};

// URL detection and linking utilities
export const detectAndLinkUrls = (text: string): (string | React.ReactElement)[] => {
  // Enhanced URL regex that matches http/https URLs
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const url = match[0];
    const cleanUrl = url.replace(/[.,;!?]+$/, ''); // Remove trailing punctuation
    
    // Create clickable link
    parts.push(
      React.createElement('a', {
        key: `url-${match.index}`,
        href: cleanUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-blue-600 hover:text-blue-800 underline break-all',
        style: { wordBreak: 'break-all' }, // Ensure long URLs don't overflow
        title: cleanUrl
      }, cleanUrl)
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

// Media detection utilities
export const detectMediaUrls = (text: string): { images: string[], videos: string[], youtubeUrls: string[], spotifyUrls: string[], otherUrls: string[] } => {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?$/i;
  const videoExtensions = /\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv|m4v)(\?[^\s]*)?$/i;
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i;
  const spotifyRegex = /https?:\/\/(?:open\.)?spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]{22})/i;
  
  // Popular GIF hosting services (often don't have .gif in URL)
  const gifHostingRegex = /https?:\/\/(?:media\.)?(?:giphy\.com\/media\/|tenor\.com\/view\/|gfycat\.com\/|imgur\.com\/[a-zA-Z0-9]+(?:\.gifv)?$)/i;
  
  const images: string[] = [];
  const videos: string[] = [];
  const youtubeUrls: string[] = [];
  const spotifyUrls: string[] = [];
  const otherUrls: string[] = [];
  
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;!?]+$/, ''); // Remove trailing punctuation
    
    if (youtubeRegex.test(url)) {
      youtubeUrls.push(url);
    } else if (spotifyRegex.test(url)) {
      spotifyUrls.push(url);
    } else if (imageExtensions.test(url) || gifHostingRegex.test(url)) {
      // Include both file extension images AND popular GIF hosting services
      images.push(url);
    } else if (videoExtensions.test(url)) {
      videos.push(url);
    } else {
      otherUrls.push(url);
    }
  }
  
  return { images, videos, youtubeUrls, spotifyUrls, otherUrls };
};

// YouTube ID extraction utility
export const extractYouTubeId = (url: string): string | null => {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
};

// Spotify ID extraction utility
export const extractSpotifyId = (url: string): { type: string, id: string } | null => {
  const spotifyRegex = /https?:\/\/(?:open\.)?spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]{22})/i;
  const match = url.match(spotifyRegex);
  return match ? { type: match[1], id: match[2] } : null;
};

// Media embedding function with size constraints
export const createMediaEmbed = (url: string, type: 'image' | 'video', key: string): React.ReactElement => {
  const maxSize = 400;
  const commonProps = {
    key: key,
    style: {
      maxWidth: `${maxSize}px`,
      maxHeight: `${maxSize}px`,
      width: 'auto',
      height: 'auto',
      cursor: 'pointer',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      margin: '8px 0'
    },
    onClick: () => window.open(url, '_blank', 'noopener,noreferrer'),
    loading: 'lazy' as const,
    title: 'Click to view full size'
  };

  if (type === 'image') {
    return React.createElement('img', {
      ...commonProps,
      src: url,
      alt: 'Embedded image',
      style: {
        ...commonProps.style,
        // Ensure GIFs animate properly - CRITICAL for animation
        imageRendering: 'auto',
        objectFit: 'contain', // Preserve aspect ratio and animation
        willChange: 'auto', // Optimize for animations
        backfaceVisibility: 'hidden' // Smooth animation rendering
      },
      // CRITICAL: These attributes ensure GIF animation
      autoPlay: true, // For some browsers
      loop: true, // Ensure continuous loop
      muted: true, // Required for some animated content
      playsInline: true, // Mobile compatibility
      onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => {
        // Force animation start on load
        const img = e.currentTarget;
        img.style.animationPlayState = 'running';
      },
      onError: (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        img.style.display = 'none';
        console.warn('[ChatHelpers] Failed to load image:', url);
      }
    });
  } else {
    return React.createElement('video', {
      ...commonProps,
      src: url,
      controls: true,
      preload: 'metadata',
      onError: (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        video.style.display = 'none';
        console.warn('[ChatHelpers] Failed to load video:', url);
      }
    });
  }
};

// YouTube embed function
export const createYouTubeEmbed = (url: string, key: string): React.ReactElement => {
  const videoId = extractYouTubeId(url);
  if (!videoId) return React.createElement('span', { key }, 'Invalid YouTube URL');

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  
  return React.createElement('div', {
    key: key,
    style: {
      position: 'relative',
      width: '400px',
      height: '225px', // 16:9 aspect ratio for 400px width
      maxWidth: '100%',
      margin: '8px 0',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }
  }, [
    React.createElement('iframe', {
      key: `iframe-${key}`,
      src: embedUrl,
      width: '400',
      height: '225',
      frameBorder: '0',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
      loading: 'lazy',
      title: 'YouTube video player',
      style: {
        width: '100%',
        height: '100%',
        border: 'none'
      }
    })
  ]);
};

// Spotify embed function
export const createSpotifyEmbed = (url: string, key: string): React.ReactElement => {
  const spotifyData = extractSpotifyId(url);
  if (!spotifyData) return React.createElement('span', { key }, 'Invalid Spotify URL');

  const { type, id } = spotifyData;
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
  
  // Compact heights for different Spotify content types
  const getHeightForType = (contentType: string): string => {
    switch (contentType) {
      case 'track':
        return '90'; // Compact track embed with album art + info
      case 'album':
        return '90'; // Compact album preview
      case 'playlist':
        return '90'; // Compact playlist preview (one-row)
      case 'episode':
        return '152'; // Taller for podcast episodes
      case 'artist':
        return '90'; // Compact artist preview
      default:
        return '90'; // Default compact size
    }
  };
  
  const height = getHeightForType(type);
  
  return React.createElement('div', {
    key: key,
    style: {
      width: '300px', // Capped at ~300px for message container width
      height: `${height}px`,
      maxWidth: '100%',
      margin: '8px 0',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }
  }, [
    React.createElement('iframe', {
      key: `iframe-${key}`,
      src: embedUrl,
      width: '300',
      height: height,
      frameBorder: '0',
      allowtransparency: 'true',
      allow: 'encrypted-media',
      loading: 'lazy',
      title: `Spotify ${type} player`,
      style: {
        width: '100%',
        height: '100%',
        border: 'none'
      }
    })
  ]);
};

// Enhanced URL processing with media embedding
export const detectAndLinkUrlsWithMedia = (text: string): (string | React.ReactElement)[] => {
  const { images, videos, youtubeUrls, spotifyUrls, otherUrls } = detectMediaUrls(text);
  const allUrls = [...images, ...videos, ...youtubeUrls, ...spotifyUrls, ...otherUrls];
  
  if (allUrls.length === 0) {
    return [text];
  }

  // Build regex for all URLs to process them in order
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;
  let mediaCounter = 0;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const url = match[0].replace(/[.,;!?]+$/, ''); // Remove trailing punctuation
    
    if (youtubeUrls.includes(url)) {
      // Embed YouTube video
      parts.push(createYouTubeEmbed(url, `youtube-${mediaCounter++}`));
    } else if (spotifyUrls.includes(url)) {
      // Show URL link on top for Spotify
      parts.push(
        React.createElement('div', {
          key: `spotify-link-${mediaCounter}`,
          style: { fontSize: '0.875rem', marginBottom: '4px', marginTop: '4px' }
        }, [
          React.createElement('a', {
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-blue-600 hover:text-blue-800 underline break-all'
          }, url)
        ])
      );
      // Then embed Spotify content
      parts.push(createSpotifyEmbed(url, `spotify-${mediaCounter++}`));
    } else if (images.includes(url)) {
      // Embed image only (no URL link)
      parts.push(createMediaEmbed(url, 'image', `image-${mediaCounter++}`));
    } else if (videos.includes(url)) {
      // Embed video only (no URL link)
      parts.push(createMediaEmbed(url, 'video', `video-${mediaCounter++}`));
    } else {
      // Regular clickable link for other URLs
      parts.push(
        React.createElement('a', {
          key: `url-${match.index}`,
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-blue-600 hover:text-blue-800 underline break-all',
          style: { wordBreak: 'break-all' },
          title: url
        }, url)
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

// Combined function to process emojis, URLs, and media
export const renderMessageWithEmojisAndUrls = (
  text: string,
  emojiFilenames: string[],
  baseUrl: string
): (string | React.ReactElement)[] => {
  // First process URLs and media
  const urlAndMediaProcessed = detectAndLinkUrlsWithMedia(text);
  
  // Then process emojis on text parts only
  const result: (string | React.ReactElement)[] = [];
  
  urlAndMediaProcessed.forEach((part) => {
    if (typeof part === 'string') {
      // Process emojis in text parts
      const emojiProcessed = renderMessageWithEmojis(part, emojiFilenames, baseUrl);
      result.push(...emojiProcessed);
    } else {
      // Keep React elements (URLs, media) as is
      result.push(part);
    }
  });
  
  return result;
};

// Export the emote loading function for use in components
export { loadEmoteList };