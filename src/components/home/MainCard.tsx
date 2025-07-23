// src/components/home/MainCard.tsx
import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card-themed';
import { cn } from '@/lib/utils';

interface MainCardProps {
  currentInterest: string;
  setCurrentInterest: (value: string) => void;
  selectedInterests: string[];
  setSelectedInterests: React.Dispatch<React.SetStateAction<string[]>>;
  usersOnline: number | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onStartChat: (type: 'text' | 'video') => void;
  onToggleSettings: () => void;
  isNavigating: boolean;
  isMobile: boolean;
  toast: any;
}

export default function MainCard({
  currentInterest,
  setCurrentInterest,
  selectedInterests,
  setSelectedInterests,
  usersOnline,
  inputRef,
  onStartChat,
  onToggleSettings,
  isNavigating,
  isMobile,
  toast
}: MainCardProps) {
  
  const handleInterestInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInterest(e.target.value);
  }, [setCurrentInterest]);

  const addInterest = useCallback((interestToAdd: string) => {
    const newInterest = interestToAdd.trim().toLowerCase();
    if (newInterest && !selectedInterests.includes(newInterest) && selectedInterests.length < 5) {
      setSelectedInterests(prev => [...prev, newInterest]);
      setCurrentInterest('');
    } else if (newInterest && selectedInterests.includes(newInterest)) {
      toast({ 
        title: "Duplicate Interest", 
        description: `"${newInterest}" is already added.`,
        variant: "default"
      });
      setCurrentInterest('');
    } else if (selectedInterests.length >= 5) {
      toast({ 
        title: "Max Interests Reached", 
        description: "You can add up to 5 interests.",
        variant: "default"
      });
      setCurrentInterest('');
    }
  }, [selectedInterests, toast, setSelectedInterests, setCurrentInterest]);

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
  }, [currentInterest, selectedInterests.length, addInterest, setSelectedInterests]);

  const handleRemoveInterest = useCallback((interestToRemove: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setSelectedInterests(prev => prev.filter(interest => interest !== interestToRemove));
  }, [setSelectedInterests]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
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
              onClick={onToggleSettings}
              disabled={isNavigating}
              variant={isMobile ? "outline" : "primary"}
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
          onClick={() => onStartChat('text')} 
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
          onClick={() => onStartChat('video')} 
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
  );
}