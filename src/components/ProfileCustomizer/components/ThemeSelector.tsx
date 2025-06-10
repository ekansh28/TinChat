// src/components/ProfileCustomizer/components/ThemeSelector.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import type { EasyCustomization } from '../types';

interface ThemeSelectorProps {
  easyCustomization: EasyCustomization;
  setEasyCustomization: React.Dispatch<React.SetStateAction<EasyCustomization>>;
  saving: boolean;
  isTheme98: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  easyCustomization,
  setEasyCustomization,
  saving,
  isTheme98
}) => {
  const themes = [
    {
      name: 'Discord Dark',
      preview: 'linear-gradient(135deg, #36393f, #2f3136)',
      config: {
        backgroundColor: '#36393f',
        backgroundGradient: {
          enabled: true,
          color1: '#36393f',
          color2: '#2f3136',
          direction: '135deg'
        }
      }
    },
    {
      name: 'Ocean Breeze',
      preview: 'linear-gradient(135deg, #667eea, #764ba2)',
      config: {
        backgroundColor: '#667eea',
        backgroundGradient: {
          enabled: true,
          color1: '#667eea',
          color2: '#764ba2',
          direction: '135deg'
        }
      }
    },
    {
      name: 'Sunset Glow',
      preview: 'linear-gradient(135deg, #ff6b6b, #ffa726)',
      config: {
        backgroundColor: '#ff6b6b',
        backgroundGradient: {
          enabled: true,
          color1: '#ff6b6b',
          color2: '#ffa726',
          direction: '135deg'
        }
      }
    },
    {
      name: 'Forest Green',
      preview: 'linear-gradient(135deg, #56ab2f, #a8e6cf)',
      config: {
        backgroundColor: '#56ab2f',
        backgroundGradient: {
          enabled: true,
          color1: '#56ab2f',
          color2: '#a8e6cf',
          direction: '135deg'
        }
      }
    },
    {
      name: 'Purple Haze',
      preview: 'linear-gradient(135deg, #8360c3, #2ebf91)',
      config: {
        backgroundColor: '#8360c3',
        backgroundGradient: {
          enabled: true,
          color1: '#8360c3',
          color2: '#2ebf91',
          direction: '135deg'
        }
      }
    },
    {
      name: 'Midnight Blue',
      preview: 'linear-gradient(135deg, #2c3e50, #3498db)',
      config: {
        backgroundColor: '#2c3e50',
        backgroundGradient: {
          enabled: true,
          color1: '#2c3e50',
          color2: '#3498db',
          direction: '135deg'
        }
      }
    }
  ];

  const applyTheme = (theme: typeof themes[0]) => {
    setEasyCustomization(prev => ({
      ...prev,
      ...theme.config
    }));
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-4",
      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
    )}>
      <h3 className="text-lg font-semibold">🎨 Theme Presets</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.name}
            onClick={() => applyTheme(theme)}
            disabled={saving}
            className={cn(
              "relative p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              isTheme98 ? "button" : "hover:border-blue-500"
            )}
          >
            <div
              className="w-full h-16 rounded mb-2"
              style={{ background: theme.preview }}
            />
            <div className="text-xs font-medium text-center">{theme.name}</div>
          </button>
        ))}
      </div>
      
      <div className="text-xs text-gray-500">
        Click on any theme to apply it instantly. You can further customize after applying.
      </div>
    </div>
  );
};