'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card-themed';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { useTheme } from '@/components/theme-provider';
import { listCursors } from '@/ai/flows/list-cursors-flow';
import pkg from '../../package.json';
const version = pkg.version;
import AuthButtons from '@/components/AuthButtons';
import Head from 'next/head';

// PayPal Donation Component
const PayPalDonationButton = () => {
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const [isPayPalLoaded, setIsPayPalLoaded] = useState(false);

  useEffect(() => {
    // Check if PayPal SDK is already loaded
    if (window.paypal) {
      setIsPayPalLoaded(true);
      return;
    }

    // Load PayPal SDK
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=BAAicsFbL_0O6JAIVsfAtTXAvf7-gID334UkkXvckpDEKX1C-pRI7jqEvqqYTwOTDtpu6E8tKG7D8px-eI&components=hosted-buttons&disable-funding=venmo&currency=USD';
    script.crossOrigin = 'anonymous';
    script.async = true;
    
    script.onload = () => {
      setIsPayPalLoaded(true);
    };

    script.onerror = () => {
      console.error('Failed to load PayPal SDK');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (isPayPalLoaded && window.paypal && paypalContainerRef.current) {
      // Clear any existing content
      paypalContainerRef.current.innerHTML = '';
      
      try {
        window.paypal.HostedButtons({
          hostedButtonId: "J4HEACJWLWEZQ"
        }).render(paypalContainerRef.current);
      } catch (error) {
        console.error('Error rendering PayPal button:', error);
      }
    }
  }, [isPayPalLoaded]);

  return (
    <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
      <h3 className="text-sm font-semibold mb-2 text-center text-gray-700 dark:text-gray-300">
        Support TinChat
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center">
        Help keep our servers running!
      </p>
      <div 
        ref={paypalContainerRef} 
        id="paypal-container-J4HEACJWLWEZQ"
        className="flex justify-center"
      >
        {!isPayPalLoaded && (
          <div className="text-xs text-gray-500 text-center py-2">
            Loading donation button...
          </div>
        )}
      </div>
    </div>
  );
};

// Declare PayPal types for TypeScript
declare global {
  interface Window {
    paypal?: {
      HostedButtons: (config: { hostedButtonId: string }) => {
        render: (container: HTMLElement) => void;
      };
    };
    stopOriginalOneko?: () => void;
    startOriginalOneko?: () => void;
    stopAnimatedGifCursor?: () => void;
    startAnimatedGifCursor?: (url: string) => void;
  }
}

export default function SelectionLobby() {
  const [currentInterest, setCurrentInterest] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [usersOnline, setUsersOnline] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { currentTheme } = useTheme();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cursorImages, setCursorImages] = useState<string[]>([]);
  const [cursorsLoading, setCursorsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const cardWrapperRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });

  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Reset isNavigating to false when the pathname changes (navigation completes)
    // This assumes that a pathname change signifies the end of navigation.
    setIsNavigating(false);
  }, [pathname]);

  // Removed prefetch calls as a debugging step
  // useEffect(() => {
  //   if (router) {
  //     router.prefetch('/chat');
  //     router.prefetch('/video-chat');
  //   }
  // }, [router]);


  useEffect(() => {
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    if (!socketServerUrl) {
      console.error("SelectionLobby: Socket server URL is not defined.");
      setUsersOnline(0);
      return;
    }

    let tempSocket: Socket | null = null;

    try {
      tempSocket = io(socketServerUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      tempSocket.on('connect', () => {
        console.log("SelectionLobby: Connected to socket server for user count.");
        tempSocket?.emit('getOnlineUserCount');
      });

      tempSocket.on('onlineUserCount', (count: number) => {
        setUsersOnline(count);
        // Disconnect after getting the count to avoid holding unnecessary connections
        tempSocket?.disconnect();
      });

      tempSocket.on('connect_error', (err) => {
        console.error("SelectionLobby: Socket connection error for user count. Full error:", err);
        setUsersOnline(0); 
        if (tempSocket?.connected) tempSocket.disconnect();
      });

      tempSocket.on('error', (err) => { 
        console.error("SelectionLobby: General socket error for user count:", err);
        setUsersOnline(0);
        if (tempSocket?.connected) tempSocket.disconnect();
      });

    } catch (error) {
        console.error("SelectionLobby: Failed to initialize socket for user count:", error);
        setUsersOnline(0);
    }

    return () => {
      if (tempSocket?.connected) {
        console.log("SelectionLobby: Disconnecting socket for user count on unmount.");
        tempSocket?.disconnect();
      } else if (tempSocket) {
        // Ensure all listeners are removed even if connection wasn't fully established
        console.log("SelectionLobby: Cleaning up non-connected socket for user count on unmount.");
        tempSocket.removeAllListeners();
        tempSocket.disconnect();
      }
    };
  }, []);

  const handleInterestInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInterest(e.target.value);
  }, []);

  const addInterest = useCallback((interestToAdd: string) => {
    const newInterest = interestToAdd.trim().toLowerCase();
    if (newInterest && !selectedInterests.includes(newInterest) && selectedInterests.length < 5) {
      setSelectedInterests(prev => [...prev, newInterest]);
      setCurrentInterest('');
    } else if (newInterest && selectedInterests.includes(newInterest)) {
      toast({ title: "Duplicate Interest", description: `"${newInterest}" is already added.`, variant: "default" });
      setCurrentInterest('');
    } else if (selectedInterests.length >= 5) {
      toast({ title: "Max Interests Reached", description: "You can add up to 5 interests.", variant: "default" });
      setCurrentInterest('');
    }
  }, [selectedInterests, toast]);

  const handleInterestInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    const value = currentInterest.trim();

    if ((key === ',' || key === ' ' || key === 'Enter') && value) {
      e.preventDefault();
      addInterest(value);
    } else if (key === 'Backspace' && !currentInterest && selectedInterests.length > 0) {
      e.preventDefault();
      setSelectedInterests(prev => prev.slice(0, -1));
    }
  }, [currentInterest, selectedInterests.length, addInterest]);

  const handleRemoveInterest = useCallback((interestToRemove: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setSelectedInterests(prev => prev.filter(interest => interest !== interestToRemove));
  }, []);

  const handleStartChat = useCallback((type: 'text' | 'video') => {
    if (!router) {
      console.error("SelectionLobby: Router is not available in handleStartChat.");
      toast({ variant: "destructive", title: "Navigation Error", description: "Could not initiate chat. Router not available." });
      setIsNavigating(false); 
      return;
    }
    setIsNavigating(true); 
    const interestsString = selectedInterests.join(',');
    const params = new URLSearchParams();
    if (interestsString) {
        params.append('interests', interestsString);
    }
    let path: string;
    const queryString = params.toString();
    if (type === 'video') {
        path = `/video-chat${queryString ? `?${queryString}` : ''}`;
    } else {
        path = `/chat${queryString ? `?${queryString}` : ''}`;
    }
    
    // router.push returns a Promise
    const navigationPromise = router.push(path);
    if (navigationPromise && typeof navigationPromise.catch === 'function') {
      navigationPromise.catch((err) => {
        console.error("Navigation failed:", err);
        toast({ variant: "destructive", title: "Navigation Error", description: "Could not start chat session." });
        setIsNavigating(false); // Reset on navigation error
      });
    } else {
      // Fallback if router.push doesn't return a promise as expected (should not happen with App Router)
      console.warn("router.push did not return a promise. isNavigating state might not reset on error.");
      // setIsNavigating will be reset by the useEffect for pathname change on success
    }
  }, [router, selectedInterests, toast]);


  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const handleToggleSettings = useCallback(async () => {
    const opening = !isSettingsOpen;
    setIsSettingsOpen(opening);

    if (opening && cardWrapperRef.current) {
      const cardRect = cardWrapperRef.current.getBoundingClientRect();
      setPanelPosition({
        top: cardRect.top + window.scrollY,
        left: cardRect.right + window.scrollX + 16
      });

      if (cursorImages.length === 0 && !cursorsLoading) {
        setSettingsError(null);
        setCursorsLoading(true);
        try {
          const fetchedCursors = await listCursors();
          setCursorImages(fetchedCursors || []);
        } catch (error: any) {
          console.error("Error fetching cursors:", error);
          setSettingsError(error.message || "Failed to load cursors.");
          setCursorImages([]);
        } finally {
          setCursorsLoading(false);
        }
      }
    }
  }, [isSettingsOpen, cardWrapperRef, cursorImages.length, cursorsLoading]);

  useEffect(() => {
    const updatePosition = () => {
      if (isSettingsOpen && cardWrapperRef.current) {
        const cardRect = cardWrapperRef.current.getBoundingClientRect();
        setPanelPosition({
          top: cardRect.top + window.scrollY,
          left: cardRect.right + window.scrollX + 16
        });
      }
    };

    if (isSettingsOpen) {
      window.addEventListener('resize', updatePosition);
      updatePosition();
    }
    return () => window.removeEventListener('resize', updatePosition);
  }, [isSettingsOpen]);


  const handleCursorSelect = useCallback((cursorUrl: string) => {
    if (typeof window === 'undefined') return;

    window.stopOriginalOneko?.();
    window.stopAnimatedGifCursor?.();
    document.body.style.cursor = 'auto';

    localStorage.removeItem('nekoActive');
    localStorage.removeItem('animatedCursorUrl');
    localStorage.removeItem('selectedCursorUrl');

    if (cursorUrl.toLowerCase().includes('neko.gif')) {
      window.startOriginalOneko?.();
      document.body.style.cursor = 'auto';
      localStorage.setItem('nekoActive', 'true');
    } else if (cursorUrl.toLowerCase().endsWith('.gif')) {
      window.startAnimatedGifCursor?.(cursorUrl);
      document.body.style.cursor = 'none';
      localStorage.setItem('animatedCursorUrl', cursorUrl);
    } else {
      document.body.style.cursor = `url(${cursorUrl}), auto`;
      localStorage.setItem('selectedCursorUrl', cursorUrl);
    }
  }, []);

  const handleDefaultCursor = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.stopOriginalOneko?.();
    window.stopAnimatedGifCursor?.();
    localStorage.removeItem('nekoActive');
    localStorage.removeItem('animatedCursorUrl');
    localStorage.removeItem('selectedCursorUrl');
    document.body.style.cursor = 'auto';
  }, []);


  return (
    <div className="flex flex-1 flex-col px-4 pt-4 relative">
      <div className="absolute top-3 right-3 flex items-center space-x-2 z-10">
        <p className="text-gray-500 text-xs">v{version}</p>
        <AuthButtons />
      </div>

      <div className="flex-grow min-h-screen flex items-center justify-center">
        <div className="flex items-start gap-6">
          {/* Main Card */}
          <div ref={cardWrapperRef} className="max-w-md">
            <Card className="relative">
              <CardHeader className="relative">
                <CardTitle>Welcome to TinChat!</CardTitle>
                <CardDescription>
                  Connect with someone new. Add interests by typing them and pressing Comma, Space, or Enter. Max 5 interests.
                </CardDescription>
                <div className="absolute top-3 right-3 flex items-center text-xs">
                  <img
                    src="/icons/greenlight.gif"
                    alt="Green light"
                    className="w-3 h-3 mr-1"
                    data-ai-hint="green light indicator"
                  />
                  {usersOnline !== null ? (
                    <span className="font-bold mr-1">{usersOnline}</span>
                  ) : (
                    <span className="font-bold mr-1">--</span>
                  )}
                  <span>Users Online!</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <Label htmlFor="interests-input-field">Your Interests</Label>
                    <Button
                      className="p-0 w-[20px] h-[20px] min-w-0 flex items-center justify-center"
                      aria-label="Settings"
                      onClick={handleToggleSettings}
                      disabled={isNavigating}
                    >
                      <img
                        src="/icons/gears-0.png"
                        alt="Settings"
                        className="max-w-full max-h-full object-contain"
                        data-ai-hint="settings icon"
                      />
                    </Button>
                  </div>
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-1 p-1.5 cursor-text themed-input rounded-md"
                    )}
                    onClick={focusInput}
                    style={{ minHeight: 'calc(1.5rem + 12px + 2px)'}}
                  >
                    {selectedInterests.map((interest) => (
                      <div
                        key={interest}
                        className="bg-black text-white pl-2 pr-1 py-0.5 rounded-sm flex items-center text-xs h-fit"
                      >
                        <span>{interest}</span>
                        <X
                          size={14}
                          className="ml-1 text-white hover:text-gray-300 cursor-pointer"
                          onClick={(e) => handleRemoveInterest(interest, e)}
                          aria-label={`Remove ${interest}`}
                        />
                      </div>
                    ))}
                    <Input
                      id="interests-input-field"
                      ref={inputRef}
                      value={currentInterest}
                      onChange={handleInterestInputChange}
                      onKeyDown={handleInterestInputKeyDown}
                      placeholder={selectedInterests.length < 5 ? "Add interest..." : "Max interests reached"}
                      className="flex-grow p-0 border-none outline-none shadow-none bg-transparent themed-input-inner"
                      style={{ minWidth: '80px' }}
                      disabled={(selectedInterests.length >= 5 && !currentInterest) || isNavigating}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Type an interest and press Comma, Space, or Enter. Backspace on empty input to remove last. Leave blank for random match.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between space-x-4">
                <Button className="flex-1 accent" onClick={() => handleStartChat('text')} disabled={isNavigating}>
                  {isNavigating ? 'Starting...' : <span className="animate-rainbow-text">Start Text Chat</span>}
                </Button>
                <Button className="flex-1 accent" onClick={() => handleStartChat('video')} disabled={isNavigating}>
                  {isNavigating ? 'Starting...' : <span className="animate-rainbow-text-alt">Start Video Chat</span>}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* PayPal Donation Button */}
          <div className="w-64">
            <PayPalDonationButton />
          </div>
        </div>
      </div>

      {isSettingsOpen && (
        <div
          className={cn(
            'fixed p-2 shadow-lg z-20',
            currentTheme === 'theme-7'
              ? 'bg-neutral-100 bg-opacity-70 backdrop-filter backdrop-blur-md border border-neutral-300 rounded-lg'
              : 'bg-silver border border-gray-400 rounded'
          )}
          style={{
            width: '250px',
            top: `${panelPosition.top}px`,
            left: `${panelPosition.left}px`,
            maxHeight: `calc(100vh - ${panelPosition.top}px - 16px)`,
            overflowY: 'auto'
          }}
        >
          <div className={cn(currentTheme === 'theme-98' ? 'p-1' : 'p-1')}>
            <menu role="tablist" className={cn(currentTheme === 'theme-98' ? 'mb-0.5' : 'mb-2 border-b border-gray-300 dark:border-gray-600')}>
              <li role="tab" aria-selected="true"
                  className={cn(
                    'inline-block py-1 px-2 cursor-default',
                    currentTheme === 'theme-98' ? 'button raised' : 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400',
                    currentTheme === 'theme-98' && '[aria-selected=true]:font-bold'
                  )}
              >
                <a>Cursors</a>
              </li>
            </menu>
            <div
              className={cn(
                currentTheme === 'theme-98' ? 'sunken-panel' : '',
                currentTheme === 'theme-7' ? 'bg-white bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 border border-gray-300 dark:border-gray-600 rounded' : ''
              )}
              role="tabpanel"
              style={{ marginTop: currentTheme === 'theme-98' ? '1px' : '' }}
            >
              <div className={cn(currentTheme === 'theme-7' ? 'p-2' : 'p-1')}>
                <Button onClick={handleDefaultCursor} className="w-full mb-2 text-xs" disabled={isNavigating}>
                  Default Cursor
                </Button>
                {cursorsLoading ? (
                  <p className="text-center">Loading cursors...</p>
                ) : settingsError ? (
                  <p className="text-red-600 text-center">Error: {settingsError}</p>
                ) : cursorImages.length > 0 ? (
                  <div className="h-48 overflow-y-auto grid grid-cols-4 gap-2 p-1">
                    {cursorImages.map((url) => (
                      <div key={url} className="flex items-center justify-center p-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                        <img
                          src={url}
                          alt="cursor preview"
                          className="w-[30px] h-[30px] object-contain cursor-pointer"
                          data-ai-hint="custom cursor preview"
                          onClick={() => handleCursorSelect(url)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center">No cursors found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto py-4 text-center">
        <div className="max-w-5xl mx-auto">
          <div className="border-t-2 border-gray-300 dark:border-gray-600 my-4 w-full"></div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 space-x-2">
          <span>tinchat.online</span>
          <span>•</span>
          <Link href="/rules" className="text-red-600 hover:underline">Rules</Link>
          <span>•</span>
          <Link href="/terms" className="text-red-600 hover:underline">Terms Of Service</Link>
          <span>•</span>
          <Link href="/privacy" className="text-red-600 hover:underline">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}