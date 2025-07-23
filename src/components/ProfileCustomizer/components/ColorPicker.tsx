// src/components/ProfileCustomizer/components/ColorPicker.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export const ColorPicker = React.memo<ColorPickerProps>(({
  color,
  onChange,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const changeTimeoutRef = useRef<NodeJS.Timeout>();

  const debouncedOnChange = useCallback((newColor: string) => {
    if (changeTimeoutRef.current) {
      clearTimeout(changeTimeoutRef.current);
    }
    changeTimeoutRef.current = setTimeout(() => {
      onChange(newColor);
    }, 100); // Adjust delay as needed
  }, [onChange]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }
    };
  }, [isOpen, handleClickOutside]);

  const handleNativeColorPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedOnChange(e.target.value);
  }, [debouncedOnChange]);

  const togglePicker = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  return (
    <div className="relative" ref={pickerRef}>
    {/* Color preview button */}
    <button
      type="button"
      onClick={togglePicker}
      disabled={disabled}
      className={cn(
        "w-5 h-5 min-w-[20px] min-h-[20px]",
        "border border-gray-300 dark:border-gray-600",
        "hover:border-gray-400 dark:hover:border-gray-500 transition-colors",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      style={{ backgroundColor: color }}
      title={`Current color: ${color}`}
      aria-label="Open color picker"
    />


      {/* Hidden native color input */}
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={handleInputChange}
        className="absolute opacity-0 w-0 h-0"
        disabled={disabled}
      />

      {/* Color picker dropdown - only render when open */}
      {isOpen && (
        <div className="absolute top-12 left-0 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[240px]">
          {/* Native color picker button */}
          <button
            type="button"
            onClick={handleNativeColorPicker}
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium transition-colors mb-3"
          >
            🎨 Choose Color
          </button>

          {/* Current color display */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current:</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-mono">{color}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});