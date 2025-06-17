// src/components/EmoteGallery.tsx - Enhanced for chat integration
import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Define the shape of a single emote
interface Emote {
  filename: string;
  width: number;
  height: number;
}

interface EmoteGalleryProps {
  onEmoteSelect?: (shortcode: string) => void; // Callback for when emote is selected
  isModal?: boolean; // Whether this is in a modal/popup
  maxHeight?: string; // Control height
  searchable?: boolean; // Enable search
  className?: string;
}

const EmoteGallery: React.FC<EmoteGalleryProps> = ({
  onEmoteSelect,
  isModal = false,
  maxHeight = '400px',
  searchable = true,
  className
}) => {
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmote, setSelectedEmote] = useState<string | null>(null);

  // Load emotes from the server
  useEffect(() => {
    setLoading(true);
    fetch('/emote_index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data: Emote[]) => {
        console.log('EmoteGallery: Loaded', data.length, 'emotes');
        setEmotes(data);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load emotes:', err);
        setError('Failed to load emotes. Please try again.');
        setEmotes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter emotes based on search term
  const filteredEmotes = React.useMemo(() => {
    if (!searchTerm.trim()) return emotes;
    
    const term = searchTerm.toLowerCase();
    return emotes.filter(emote => 
      emote.filename.toLowerCase().includes(term)
    );
  }, [emotes, searchTerm]);

  // Handle emote selection
  const handleEmoteClick = useCallback((emote: Emote) => {
    const shortcode = emote.filename.split('.')[0]; // Remove file extension
    console.log('EmoteGallery: Selected emote:', shortcode);
    
    setSelectedEmote(shortcode);
    
    // Call parent callback if provided
    if (onEmoteSelect) {
      onEmoteSelect(shortcode);
    }
    
    // Clear selection after a brief highlight
    setTimeout(() => {
      setSelectedEmote(null);
    }, 200);
  }, [onEmoteSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, emote: Emote) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleEmoteClick(emote);
    }
  }, [handleEmoteClick]);

  if (loading) {
    return (
      <div className={cn(
        "flex items-center justify-center p-8",
        isModal ? "min-h-[200px]" : "min-h-[300px]",
        className
      )}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading emotes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "flex items-center justify-center p-8",
        isModal ? "min-h-[200px]" : "min-h-[300px]",
        className
      )}>
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">⚠️ {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("emote-gallery", className)}>
      {/* Search bar */}
      {searchable && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search emotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
          />
        </div>
      )}

      {/* Stats */}
      <div className="mb-3 text-xs text-gray-600 dark:text-gray-400 flex justify-between items-center">
        <span>
          {filteredEmotes.length} emote{filteredEmotes.length !== 1 ? 's' : ''}
          {searchTerm && ` (filtered from ${emotes.length})`}
        </span>
        {onEmoteSelect && (
          <span className="text-blue-600 dark:text-blue-400">
            Click emotes to insert into chat
          </span>
        )}
      </div>

      {/* Emote grid */}
      <div 
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {filteredEmotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? (
              <>
                <p className="mb-2">No emotes found for "{searchTerm}"</p>
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  Clear search
                </button>
              </>
            ) : (
              <p>No emotes available</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {filteredEmotes.map((emote, index) => {
              const shortcode = emote.filename.split('.')[0];
              const isSelected = selectedEmote === shortcode;
              
              return (
                <div 
                  key={`${emote.filename}-${index}`}
                  className={cn(
                    "flex flex-col items-center p-2 rounded cursor-pointer transition-all duration-200",
                    "hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-105",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                    isSelected && "bg-blue-100 dark:bg-blue-900 scale-105",
                    onEmoteSelect && "hover:shadow-md"
                  )}
                  onClick={() => handleEmoteClick(emote)}
                  onKeyDown={(e) => handleKeyDown(e, emote)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Insert ${shortcode} emote`}
                  title={`${shortcode} (${emote.width}×${emote.height})`}
                >
                  <img
                    src={`/emotes/${emote.filename}`}
                    width={emote.width}
                    height={emote.height}
                    alt={shortcode}
                    className={cn(
                      "max-w-full max-h-12 object-contain transition-transform duration-200",
                      "border border-gray-200 dark:border-gray-600 rounded",
                      isSelected && "border-blue-500"
                    )}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      console.warn('Failed to load emote:', emote.filename);
                    }}
                  />
                  <span className={cn(
                    "text-xs text-gray-500 dark:text-gray-400 mt-1 text-center break-all",
                    "group-hover:text-gray-700 dark:group-hover:text-gray-300",
                    isSelected && "text-blue-600 dark:text-blue-400 font-medium"
                  )}>
                    :{shortcode}:
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage instructions */}
      {onEmoteSelect && !isModal && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
          <p className="text-blue-800 dark:text-blue-200">
            <strong>💡 Tip:</strong> Click any emote to insert it into your message, 
            or type <code>:emotename:</code> in chat to use emotes manually.
          </p>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-gray-500">Debug Info</summary>
          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
            {JSON.stringify({
              totalEmotes: emotes.length,
              filteredEmotes: filteredEmotes.length,
              searchTerm,
              selectedEmote,
              hasCallback: !!onEmoteSelect
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default EmoteGallery;