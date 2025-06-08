// src/components/ProfileCustomizer/components/BadgeManager.tsx
import React from 'react';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import { cn } from '@/lib/utils';
import { useBadgeManager } from '../hooks/useBadgeManager';
import type { Badge } from '../types';

interface BadgeManagerProps {
  badges: Badge[];
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>;
  isBadgeManagerOpen: boolean;
  setIsBadgeManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
  isTheme98: boolean;
}

export const BadgeManager: React.FC<BadgeManagerProps> = ({
  badges,
  setBadges,
  isBadgeManagerOpen,
  setIsBadgeManagerOpen,
  saving,
  isTheme98
}) => {
  const {
    newBadgeUrl,
    setNewBadgeUrl,
    newBadgeName,
    setNewBadgeName,
    addBadge,
    removeBadge,
    reorderBadges
  } = useBadgeManager({ badges, setBadges });

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-4",
      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Badges ({badges.length})</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsBadgeManagerOpen(!isBadgeManagerOpen)}
          disabled={saving}
        >
          {isBadgeManagerOpen ? 'Hide' : 'Manage'} Badges
        </Button>
      </div>

      {/* Badge Grid Preview */}
      {badges.length > 0 && (
        <div className="grid grid-cols-6 gap-2">
          {badges.map((badge, index) => (
            <div
              key={badge.id}
              className={cn(
                "relative group",
                isTheme98 ? "sunken-panel" : "bg-white dark:bg-gray-700 rounded border"
              )}
            >
              <img
                src={badge.url}
                alt={badge.name || `Badge ${index + 1}`}
                className="w-full h-10 object-cover rounded"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/icons/broken-image.png';
                }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeBadge(badge.id)}
                  disabled={saving}
                  className="text-xs p-1 h-6 w-6"
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Badge Manager Panel */}
      {isBadgeManagerOpen && (
        <div className={cn(
          "p-4 rounded border space-y-4",
          isTheme98 ? "sunken-panel" : "bg-white dark:bg-gray-700"
        )}>
          <h4 className="font-medium">Add New Badge</h4>
          
          {/* Add Badge Form */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="badge-url">Badge Image URL</Label>
              <Input
                id="badge-url"
                value={newBadgeUrl}
                onChange={(e) => setNewBadgeUrl(e.target.value)}
                placeholder="https://example.com/badge.png"
                disabled={saving}
                className="text-sm"
              />
            </div>
            
            <div>
              <Label htmlFor="badge-name">Badge Name (Optional)</Label>
              <Input
                id="badge-name"
                value={newBadgeName}
                onChange={(e) => setNewBadgeName(e.target.value.slice(0, 30))}
                placeholder="Badge name..."
                maxLength={30}
                disabled={saving}
                className="text-sm"
              />
              <div className="mt-1 text-xs text-gray-500">
                {newBadgeName.length}/30
              </div>
            </div>
            
            <Button
              type="button"
              onClick={addBadge}
              disabled={saving || !newBadgeUrl.trim()}
              size="sm"
              className="w-full"
            >
              Add Badge
            </Button>
          </div>

          {/* Existing Badges List */}
          {badges.length > 0 && (
            <div className="space-y-2">
              <h5 className="font-medium text-sm">Current Badges</h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {badges.map((badge, index) => (
                  <div
                    key={badge.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded border",
                      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-600"
                    )}
                  >
                    <img
                      src={badge.url}
                      alt={badge.name || `Badge ${index + 1}`}
                      className="w-8 h-8 object-cover rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/icons/broken-image.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {badge.name || `Badge ${index + 1}`}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {badge.url}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => reorderBadges(index, index - 1)}
                          disabled={saving}
                          className="w-6 h-6 p-0 text-xs"
                        >
                          ↑
                        </Button>
                      )}
                      {index < badges.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => reorderBadges(index, index + 1)}
                          disabled={saving}
                          className="w-6 h-6 p-0 text-xs"
                        >
                          ↓
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeBadge(badge.id)}
                        disabled={saving}
                        className="w-6 h-6 p-0 text-xs"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            <p>• Badge images should be square (1:1 ratio) for best results</p>
            <p>• Maximum 10 badges recommended</p>
            <p>• Use publicly accessible image URLs</p>
          </div>
        </div>
      )}
    </div>
  );
};