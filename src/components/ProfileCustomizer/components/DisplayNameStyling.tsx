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
  return (
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
            <input
              id="displayNameColor"
              type="color"
              value={displayNameColor}
              onChange={(e) => setDisplayNameColor(e.target.value)}
              disabled={saving}
              className={cn(
                "w-12 h-10 rounded border cursor-pointer",
                isTheme98 ? "sunken-panel" : "border-gray-300"
              )}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {displayNameColor.toUpperCase()}
            </span>
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
          "p-4 rounded border bg-gray-900 flex items-center justify-center min-h-[60px]",
          isTheme98 ? "sunken-panel" : ""
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
              color: displayNameAnimation === 'none' ? displayNameColor : undefined,
              animationDuration: displayNameAnimation === 'rainbow' ? `${rainbowSpeed}s` : undefined
            }}
          >
            Display Name
          </span>
        </div>
      </div>
    </div>
  );
};