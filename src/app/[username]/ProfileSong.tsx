// components/myspace/ProfileSong.tsx
import { useState } from 'react';

interface ProfileSongProps {
  title: string;
  artist: string;
  audioUrl?: string; // Optional since the component checks for its existence
}

export default function ProfileSong({ title, artist, audioUrl }: ProfileSongProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="bg-gray-100 p-3 rounded border border-gray-300">
      <h3 className="font-bold">Profile Song</h3>
      <p className="text-sm">{title} by {artist}</p>
      {audioUrl && (
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
      )}
      {isPlaying && audioUrl && (
        <audio autoPlay loop src={audioUrl} />
      )}
    </div>
  );
}