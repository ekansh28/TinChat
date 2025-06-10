// Add this to your existing src/lib/utils.ts file

export const playSound = (filename: string) => {
  try {
    if (typeof window !== 'undefined') {
      const audio = new Audio(`/sounds/${filename}`);
      audio.volume = 0.5;
      audio.play().catch(err => {
        console.warn('Could not play sound:', err);
      });
    }
  } catch (err) {
    console.warn('Error creating audio:', err);
  }
};