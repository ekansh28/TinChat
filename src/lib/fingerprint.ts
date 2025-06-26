// src/lib/utils/fingerprint.ts - NEW UTILITY

// Extend Navigator interface for optional properties
interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
  };
}

/**
 * Generates a device fingerprint for socket identification.
 * This helps prevent duplicate connections and improves connection management
 */
export function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  try {
    const nav = navigator as ExtendedNavigator;
    
    const components = [
      nav.userAgent || 'unknown',
      nav.language || 'unknown',
      screen.width || 0,
      screen.height || 0,
      screen.colorDepth || 0,
      new Date().getTimezoneOffset(),
      nav.hardwareConcurrency || 0,
      nav.deviceMemory || 0, // Now properly typed
      window.devicePixelRatio || 1,
      nav.connection?.effectiveType || 'unknown'
    ];

    // Create a simple hash of the components
    const fingerprint = components.join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive hex string and add timestamp for uniqueness
    const hashStr = Math.abs(hash).toString(16);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    
    return `fp-${hashStr}-${timestamp}-${random}`;
  } catch (error) {
    console.warn('Error generating device fingerprint:', error);
    // Fallback to random ID
    return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}