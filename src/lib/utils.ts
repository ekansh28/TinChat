// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Optional: Add other utility functions you might need
export function playSound(filename: string): void {
  try {
    const audio = new Audio(`/sounds/${filename}`);
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.warn('Could not play sound:', err);
    });
  } catch (err) {
    console.warn('Error creating audio:', err);
  }
}