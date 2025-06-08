// src/app/page.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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

// Declare global types for TypeScript
declare global {
  interface Window {
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
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Reset isNavigating to false when the pathname changes (navigation completes)
    setIsNavigating(false);
  }, [pathname]);

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
      
      // Adjust positioning for mobile
      if (isMobile) {
        setPanelPosition({
          top: cardRect.bottom + window.scrollY + 8,
          left: Math.max(8, (window.innerWidth - 250) / 2)
        });
      } else {
        setPanelPosition({
          top: cardRect.top + window.scrollY,
          left: cardRect.right + window.scrollX + 16
        });
      }

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
  }, [isSettingsOpen, cardWrapperRef, cursorImages.length, cursorsLoading, isMobile]);

  useEffect(() => {
    const updatePosition = () => {
      if (isSettingsOpen && cardWrapperRef.current) {
        const cardRect = cardWrapperRef.current.getBoundingClientRect();
        
        if (isMobile) {
          setPanelPosition({
            top: cardRect.bottom + window.scrollY + 8,
            left: Math.max(8, (window.innerWidth - 250) / 2)
          });
        } else {
          setPanelPosition({
            top: cardRect.top + window.scrollY,
            left: cardRect.right + window.scrollX + 16
          });
        }
      }
    };

    if (isSettingsOpen) {
      window.addEventListener('resize', updatePosition);
      updatePosition();
    }
    return () => window.removeEventListener('resize', updatePosition);
  }, [isSettingsOpen, isMobile]);

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
    <div className={cn(
      "flex flex-1 flex-col relative min-h-screen",
      isMobile ? "px-3 pt-3 pb-safe" : "px-4 pt-4"
    )}>
      {/* Header - Mobile Optimized */}
      <div className={cn(
        "absolute top-3 right-3 flex items-center space-x-2 z-20",
        isMobile && "top-2 right-2 space-x-1"
      )}>
        <p className={cn(
          "text-gray-500",
          isMobile ? "text-xs" : "text-xs"
        )}>
          v{version}
        </p>
        <div className={cn(isMobile && "scale-90")}>
          <AuthButtons />
        </div>
      </div>

      {/* Main Content - Mobile Responsive */}
      <div className={cn(
        "flex-grow flex items-center justify-center",
        isMobile ? "min-h-[calc(100vh-2rem)] py-4" : "min-h-screen"
      )}>
        <div className={cn(
          "flex flex-col items-center w-full relative",
          isMobile ? "space-y-4" : "space-y-6"
        )}>
          {/* Discord Link - Left side of card */}
          <Link 
            href="https://discord.gg/gayporn" 
            target="_blank" 
            rel="noopener noreferrer"
            className={cn(
              "absolute z-10 transition-transform hover:scale-110",
              isMobile 
                ? "left-2 top-1/2 transform -translate-y-1/2" 
                : "left-0 top-1/2 transform -translate-y-1/2 -translate-x-16"
            )}
          >
            <Image
              src="/icons/discord.gif"
              alt="discord"
              width={isMobile ? 32 : 40}
              height={isMobile ? 32 : 40}
              className="transition-opacity hover:opacity-80"
            />
          </Link>

          {/* Main Card - Mobile Responsive */}
          <div ref={cardWrapperRef} className={cn(
            "relative z-10 w-full",
            isMobile ? "max-w-sm px-1" : "max-w-md"
          )}>
            <Card className="relative">
              <CardHeader className={cn(
                "relative",
                isMobile && "pb-4"
              )}>
                <CardTitle className={cn(
                  isMobile ? "text-lg text-center" : "text-xl"
                )}>
                  Welcome to TinChat!
                </CardTitle>
                <CardDescription className={cn(
                  isMobile ? "text-sm text-center" : "text-base"
                )}>
                  Connect with someone new. Add interests by typing them and pressing Comma, Space, or Enter. Max 5 interests.
                </CardDescription>
                
                {/* Online Users Indicator - Mobile Positioned */}
                <div className={cn(
                  "flex items-center text-xs",
                  isMobile 
                    ? "justify-center mt-2" 
                    : "absolute top-3 right-3"
                )}>
                  <img
                    src="/icons/greenlight.gif"
                    alt="Green light"
                    className={cn(
                      "mr-1",
                      isMobile ? "w-2.5 h-2.5" : "w-3 h-3"
                    )}
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
              
              <CardContent className={cn(
                "space-y-4",
                isMobile && "px-4"
              )}>
                <div className="space-y-2">
                  <div className={cn(
                    "flex justify-between items-center mb-2",
                    isMobile && "flex-col space-y-2"
                  )}>
                    <Label 
                      htmlFor="interests-input-field" 
                      className={cn(
                        isMobile ? "text-sm font-medium" : ""
                      )}
                    >
                      Your Interests
                    </Label>
                    
                    {/* Settings Button - Mobile Positioned */}
                    <Button
                      className={cn(
                        "flex items-center justify-center relative z-30",
                        isMobile 
                          ? "w-8 h-8 p-0 min-w-0" 
                          : "p-0 w-[20px] h-[20px] min-w-0"
                      )}
                      aria-label="Settings"
                      onClick={handleToggleSettings}
                      disabled={isNavigating}
                      variant={isMobile ? "outline" : "default"}
                      size="sm"
                    >
                      <img
                        src="/icons/gears-0.png"
                        alt="Settings"
                        className={cn(
                          "object-contain",
                          isMobile ? "w-4 h-4" : "max-w-full max-h-full"
                        )}
                        data-ai-hint="settings icon"
                      />
                    </Button>
                  </div>
                  
                  {/* Interests Input - Mobile Optimized */}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-1 cursor-text themed-input rounded-md",
                      isMobile ? "p-2 min-h-[44px]" : "p-1.5"
                    )}
                    onClick={focusInput}
                    style={{ minHeight: isMobile ? '44px' : 'calc(1.5rem + 12px + 2px)' }}
                  >
                    {selectedInterests.map((interest) => (
                      <div
                        key={interest}
                        className={cn(
                          "bg-black text-white pl-2 pr-1 py-0.5 rounded-sm flex items-center h-fit",
                          isMobile ? "text-xs" : "text-xs"
                        )}
                      >
                        <span>{interest}</span>
                        <X
                          size={isMobile ? 12 : 14}
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
                      className={cn(
                        "flex-grow p-0 border-none outline-none shadow-none bg-transparent themed-input-inner",
                        isMobile ? "text-base min-w-[120px]" : "min-w-[80px]"
                      )}
                      disabled={(selectedInterests.length >= 5 && !currentInterest) || isNavigating}
                      autoComplete="off"
                      autoCapitalize="none"
                    />
                  </div>
                  
                  <p className={cn(
                    "text-gray-500 dark:text-gray-400",
                    isMobile ? "text-xs leading-relaxed" : "text-xs"
                  )}>
                    Type an interest and press Comma, Space, or Enter. Backspace on empty input to remove last. Leave blank for random match.
                  </p>
                </div>
              </CardContent>
              
              {/* Action Buttons - Mobile Optimized */}
              <CardFooter className={cn(
                "flex space-x-4",
                isMobile ? "flex-col space-x-0 space-y-3 px-4 pb-6" : "justify-between"
              )}>
                <Button 
                  className={cn(
                    "accent transition-all duration-200",
                    isMobile ? "w-full h-12 text-base" : "flex-1"
                  )} 
                  onClick={() => handleStartChat('text')} 
                  disabled={isNavigating}
                >
                  {isNavigating ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Starting...
                    </div>
                  ) : (
                    <span className="animate-rainbow-text">Start Text Chat</span>
                  )}
                </Button>
                
                <Button 
                  className={cn(
                    "accent transition-all duration-200",
                    isMobile ? "w-full h-12 text-base" : "flex-1"
                  )} 
                  onClick={() => handleStartChat('video')} 
                  disabled={isNavigating}
                >
                  {isNavigating ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Starting...
                    </div>
                  ) : (
                    <span className="animate-rainbow-text-alt">Start Video Chat</span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Donate Link - Right side of card */}
          <Link 
            href="https://paypal.me/ekansh32" 
            target="_blank" 
            rel="noopener noreferrer"
            className={cn(
              "absolute z-10 transition-transform hover:scale-110",
              isMobile 
                ? "right-2 top-1/2 transform -translate-y-1/2" 
                : "right-0 top-1/2 transform -translate-y-1/2 translate-x-16"
            )}
          >
            <Image
              src="/icons/donate.png"
              alt="donate"
              width={isMobile ? 32 : 40}
              height={isMobile ? 32 : 40}
              className="transition-opacity hover:opacity-80"
            />
          </Link>
        </div>
      </div>

      {/* Settings Panel - Mobile Responsive */}
      {isSettingsOpen && (
        <div
          className={cn(
            'fixed p-2 shadow-lg z-[9999]',
            currentTheme === 'theme-7'
              ? 'bg-neutral-100 bg-opacity-70 backdrop-filter backdrop-blur-md border border-neutral-300 rounded-lg'
              : 'bg-silver border border-gray-400 rounded',
            isMobile && 'mx-2'
          )}
          style={{
            width: isMobile ? 'calc(100vw - 16px)' : '250px',
            maxWidth: isMobile ? '300px' : '250px',
            top: `${panelPosition.top}px`,
            left: `${panelPosition.left}px`,
            maxHeight: `calc(100vh - ${panelPosition.top}px - 16px)`,
            overflowY: 'auto'
          }}
        >
          <div className={cn(currentTheme === 'theme-98' ? 'p-1' : 'p-1')}>
            {/* Close button for mobile */}
            {isMobile && (
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-sm">Settings</h4>
                <Button
                  onClick={() => setIsSettingsOpen(false)}
                  variant="outline"
                  size="sm"
                  className="w-6 h-6 p-0"
                >
                  <X size={12} />
                </Button>
              </div>
            )}
            
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
                <Button 
                  onClick={handleDefaultCursor} 
                  className={cn(
                    "w-full mb-2",
                    isMobile ? "text-xs h-8" : "text-xs"
                  )} 
                  disabled={isNavigating}
                >
                  Default Cursor
                </Button>
                
                {cursorsLoading ? (
                  <p className="text-center text-xs">Loading cursors...</p>
                ) : settingsError ? (
                  <p className="text-red-600 text-center text-xs">Error: {settingsError}</p>
                ) : cursorImages.length > 0 ? (
                  <div className={cn(
                    "overflow-y-auto grid gap-2 p-1",
                    isMobile 
                      ? "h-32 grid-cols-3" 
                      : "h-48 grid-cols-4"
                  )}>
                    {cursorImages.map((url) => (
                      <div key={url} className="flex items-center justify-center p-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                        <img
                          src={url}
                          alt="cursor preview"
                          className={cn(
                            "object-contain cursor-pointer",
                            isMobile ? "w-6 h-6" : "w-[30px] h-[30px]"
                          )}
                          data-ai-hint="custom cursor preview"
                          onClick={() => handleCursorSelect(url)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs">No cursors found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer - Mobile Responsive */}
      <footer className={cn(
        "mt-auto py-4 text-center relative z-10",
        isMobile && "py-3"
      )}>
        <div className="max-w-5xl mx-auto">
          <div className="border-t-2 border-gray-300 dark:border-gray-600 my-4 w-full"></div>
        </div>
        <p className={cn(
          "text-gray-500 dark:text-gray-400",
          isMobile ? "text-xs space-y-1 flex flex-col" : "text-sm space-x-2"
        )}>
          {isMobile ? (
            <>
              <span>tinchat.online</span>
              <span className="space-x-2">
                <Link href="/rules" className="text-red-600 hover:underline">Rules</Link>
                <span>•</span>
                <Link href="/terms" className="text-red-600 hover:underline">Terms</Link>
                <span>•</span>
                <Link href="/privacy" className="text-red-600 hover:underline">Privacy</Link>
              </span>
            </>
          ) : (
            <>
              <span>tinchat.online</span>
              <span>•</span>
              <Link href="/rules" className="text-red-600 hover:underline">Rules</Link>
              <span>•</span>
              <Link href="/terms" className="text-red-600 hover:underline">Terms Of Service</Link>
              <span>•</span>
              <Link href="/privacy" className="text-red-600 hover:underline">Privacy</Link>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}