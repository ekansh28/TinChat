// ===== src/lib/utils.ts - Add missing playSound function =====
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add missing playSound function
export function playSound(soundFile: string, volume: number = 0.5) {
  try {
    if (typeof window !== 'undefined' && 'Audio' in window) {
      const audio = new Audio(`/sounds/${soundFile}`);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(error => {
        console.warn('Could not play sound:', error);
      });
    }
  } catch (error) {
    console.warn('Error playing sound:', error);
  }
}
