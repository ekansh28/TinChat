// src/utils/themeManager.ts
// Utility functions for managing custom theme stamps

export interface CustomThemeStamp {
  name: string;
  imageUrl: string;
  cssFile: string;
  dataAiHint: string;
  createdAt?: number;
}

// Storage keys for different Windows themes
export const STORAGE_KEYS = {
  win98: 'customThemeStamps_win98',
  win7: 'customThemeStamps_win7',
  winxp: 'customThemeStamps_winxp'
} as const;

// Get all custom stamps for a specific mode
export const getCustomStamps = (mode: 'win98' | 'win7' | 'winxp'): CustomThemeStamp[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS[mode]);
    if (!stored) return [];
    
    const stamps = JSON.parse(stored);
    return Array.isArray(stamps) ? stamps : [];
  } catch (error) {
    return [];
  }
};

// Save a custom stamp
export const saveCustomStamp = (
  mode: 'win98' | 'win7' | 'winxp', 
  stamp: Omit<CustomThemeStamp, 'createdAt'>
): boolean => {
  try {
    const existing = getCustomStamps(mode);
    const newStamp: CustomThemeStamp = {
      ...stamp,
      createdAt: Date.now()
    };
    
    // Check if stamp with same CSS file already exists
    const existingIndex = existing.findIndex(s => s.cssFile === stamp.cssFile);
    
    if (existingIndex >= 0) {
      // Update existing
      existing[existingIndex] = newStamp;
    } else {
      // Add new
      existing.push(newStamp);
    }
    
    localStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(existing));
    return true;
  } catch (error) {
    return false;
  }
};

// Remove a custom stamp
export const removeCustomStamp = (
  mode: 'win98' | 'win7' | 'winxp', 
  cssFile: string
): boolean => {
  try {
    const existing = getCustomStamps(mode);
    const filtered = existing.filter(stamp => stamp.cssFile !== cssFile);
    
    localStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(filtered));
    return true;
  } catch (error) {
    return false;
  }
};

// Validate CSS file name
export const validateCssFileName = (fileName: string): { valid: boolean; error?: string } => {
  if (!fileName || !fileName.trim()) {
    return { valid: false, error: 'CSS filename is required' };
  }
  
  const trimmed = fileName.trim();
  
  // Check extension
  if (!trimmed.toLowerCase().endsWith('.css')) {
    return { valid: false, error: 'File must have .css extension' };
  }
  
  // Check length
  if (trimmed.length > 50) {
    return { valid: false, error: 'Filename too long (max 50 characters)' };
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(trimmed)) {
    return { valid: false, error: 'Filename contains invalid characters' };
  }
  
  // Check minimum length
  if (trimmed.length < 5) { // At least "a.css"
    return { valid: false, error: 'Filename too short' };
  }
  
  return { valid: true };
};

// Get total number of custom stamps across all modes
export const getTotalCustomStamps = (): number => {
  return getCustomStamps('win98').length + 
         getCustomStamps('win7').length + 
         getCustomStamps('winxp').length;
};

// Export all custom stamps (for backup)
export const exportCustomStamps = (): string => {
  const allStamps = {
    win98: getCustomStamps('win98'),
    win7: getCustomStamps('win7'),
    winxp: getCustomStamps('winxp'),
    exportedAt: Date.now(),
    version: '1.0'
  };
  
  return JSON.stringify(allStamps, null, 2);
};

// Import custom stamps (from backup)
export const importCustomStamps = (jsonData: string): boolean => {
  try {
    const data = JSON.parse(jsonData);
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }
    
    // Validate structure
    const modes: Array<'win98' | 'win7' | 'winxp'> = ['win98', 'win7', 'winxp'];
    
    for (const mode of modes) {
      if (data[mode] && Array.isArray(data[mode])) {
        // Validate each stamp
        const stamps = data[mode].filter((stamp: any) => 
          stamp && 
          typeof stamp.name === 'string' && 
          typeof stamp.cssFile === 'string' &&
          typeof stamp.imageUrl === 'string'
        );
        
        localStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(stamps));
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

// Clear all custom stamps for a mode
export const clearCustomStamps = (mode: 'win98' | 'win7' | 'winxp'): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEYS[mode]);
    return true;
  } catch (error) {
    return false;
  }
};

// Clear all custom stamps for all modes
export const clearAllCustomStamps = (): boolean => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    return false;
  }
};

// Get storage usage info
export const getStorageInfo = (): {
  totalStamps: number;
  win98Count: number;
  win7Count: number;
  winxpCount: number;
  estimatedSize: string;
} => {
  const win98Stamps = getCustomStamps('win98');
  const win7Stamps = getCustomStamps('win7');
  const winxpStamps = getCustomStamps('winxp');
  
  // Estimate storage size (rough calculation)
  const totalData = JSON.stringify({
    win98: win98Stamps,
    win7: win7Stamps,
    winxp: winxpStamps
  });
  
  const sizeInBytes = new Blob([totalData]).size;
  const sizeInKB = (sizeInBytes / 1024).toFixed(1);
  const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
  
  return {
    totalStamps: win98Stamps.length + win7Stamps.length + winxpStamps.length,
    win98Count: win98Stamps.length,
    win7Count: win7Stamps.length,
    winxpCount: winxpStamps.length,
    estimatedSize: sizeInBytes > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`
  };
};

// Generate a downloadable backup file
export const downloadBackup = (): void => {
  try {
    const backup = exportCustomStamps();
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `tinchat-themes-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
  }
};

// Console utilities for debugging (only in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).themeManager = {
    getCustomStamps,
    saveCustomStamp,
    removeCustomStamp,
    exportCustomStamps,
    importCustomStamps,
    clearAllCustomStamps,
    getStorageInfo,
    downloadBackup,
    validateCssFileName
  };
}