// src/components/ProfileCustomizer/components/DisplayNameStyling.tsx
import React from 'react';
import { Label } from '@/components/ui/label-themed';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-themed';
import { cn } from '@/lib/utils';
import { DISPLAY_NAME_ANIMATIONS } from '../utils/constants';
import type { DisplayNameAnimation } from '../types';

interface DisplayNameStylingProps {
  displayNameColor: string;
  setDisplayNameColor: (value: string) => void;
  displayNameAnimation: DisplayNameAnimation;
  setDisplayNameAnimation: (value: DisplayNameAnimation) => void;
  rainbowSpeed: number;
  setRainbowSpeed: (value: number) => void;
  saving: boolean;
  isTheme98: boolean;
}

export const DisplayNameStyling: React.FC<DisplayNameStylingProps> = ({
  displayNameColor,
  setDisplayNameColor,
  displayNameAnimation,
  setDisplayNameAnimation,
  rainbowSpeed,
  setRainbowSpeed,
  saving,
  isTheme98
}) => {
  // Ensure color is valid hex
  const safeDisplayNameColor = displayNameColor && displayNameColor.startsWith('#') 
    ? displayNameColor 
    : '#ffffff';

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    if (newColor && newColor.startsWith('#')) {
      setDisplayNameColor(newColor);
    }
  };

  return (
    <>
      {/* Inject CSS for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .display-name-rainbow {
            background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: rainbow ${rainbowSpeed}s ease-in-out infinite;
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

          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
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
        `
      }} />

      <div className={cn(
        "p-4 rounded-lg border space-y-4",
        isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
      )}>
        <h3 className="text-lg font-semibold mb-4">Display Name Styling</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Color Picker */}
          <div>
            <Label htmlFor="displayNameColor">Text Color</Label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  id="displayNameColor"
                  type="color"
                  value={safeDisplayNameColor}
                  onChange={handleColorChange}
                  disabled={saving || displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient'}
                  className={cn(
                    "w-12 h-10 rounded border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                    isTheme98 ? "sunken-panel" : "border-gray-300"
                  )}
                />
                {(displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient') && (
                  <div className="absolute inset-0 bg-gray-500 bg-opacity-50 rounded flex items-center justify-center">
                    <span className="text-white text-xs">N/A</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {safeDisplayNameColor.toUpperCase()}
                </span>
                {(displayNameAnimation === 'rainbow' || displayNameAnimation === 'gradient') && (
                  <span className="text-xs text-gray-500">
                    Color disabled for {displayNameAnimation} animation
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Animation Selection */}
          <div>
            <Label htmlFor="displayNameAnimation">Animation</Label>
            <Select 
              value={displayNameAnimation} 
              onValueChange={(value: DisplayNameAnimation) => setDisplayNameAnimation(value)}
            >
              <SelectTrigger disabled={saving}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPLAY_NAME_ANIMATIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rainbow Speed Slider (only show when rainbow animation is selected) */}
        {displayNameAnimation === 'rainbow' && (
          <div>
            <Label htmlFor="rainbowSpeed">Rainbow Speed</Label>
            <div className="px-2">
              <input
                id="rainbowSpeed"
                type="range"
                value={rainbowSpeed}
                onChange={(e) => setRainbowSpeed(parseFloat(e.target.value))}
                min="1"
                max="10"
                step="0.5"
                disabled={saving}
                className={cn(
                  "w-full h-2 rounded-lg appearance-none cursor-pointer",
                  isTheme98 
                    ? "bg-gray-300" 
                    : "bg-gray-200 dark:bg-gray-700"
                )}
                style={{
                  background: isTheme98 
                    ? '#c0c0c0' 
                    : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((rainbowSpeed - 1) / 9) * 100}%, #e5e7eb ${((rainbowSpeed - 1) / 9) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Slow (1s)</span>
                <span className="font-medium">{rainbowSpeed}s</span>
                <span>Fast (10s)</span>
              </div>
            </div>
          </div>
        )}

        {/* Animation Preview */}
        <div className="mt-4">
          <Label>Preview</Label>
          <div className={cn(
            "p-4 rounded border flex items-center justify-center min-h-[80px]",
            isTheme98 ? "sunken-panel bg-gray-900" : "bg-gray-900"
          )}>
            <span
              className={cn(
                "text-2xl font-bold transition-all duration-300",
                displayNameAnimation === 'rainbow' && 'display-name-rainbow',
                displayNameAnimation === 'gradient' && 'display-name-gradient',
                displayNameAnimation === 'pulse' && 'display-name-pulse',
                displayNameAnimation === 'glow' && 'display-name-glow'
              )}
              style={{
                color: displayNameAnimation === 'none' ? safeDisplayNameColor : undefined,
                animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined
              }}
            >
              Display Name Preview
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p>• This is how your display name will appear in chat and on your profile</p>
            <p>• Animation effects apply in real-time during conversations</p>
            {displayNameAnimation !== 'none' && (
              <p>• {displayNameAnimation === 'rainbow' ? 'Rainbow' : displayNameAnimation === 'gradient' ? 'Gradient' : displayNameAnimation === 'pulse' ? 'Pulse' : 'Glow'} animation will be visible to other users</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};