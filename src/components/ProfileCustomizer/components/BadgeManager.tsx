// src/components/ProfileCustomizer/components/BadgeManager.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import { cn } from '@/lib/utils';
import { useBadgeManager } from '../hooks/useBadgeManager';
import { useToast } from '@/hooks/use-toast';
import type { Badge } from '../types';

interface BadgeManagerProps {
  badges: Badge[];
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>;
  isBadgeManagerOpen: boolean;
  setIsBadgeManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
  isTheme98: boolean;
}

// Enhanced image validation
const validateImageFile = (file: File): Promise<{valid: boolean, error?: string}> => {
  return new Promise((resolve) => {
    // Basic checks
    if (!file.type.startsWith('image/')) {
      resolve({ valid: false, error: 'File must be an image' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      resolve({ valid: false, error: 'File size must be under 5MB' });
      return;
    }

    // Advanced validation: try to load the image
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    const cleanup = () => URL.revokeObjectURL(url);
    
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ valid: false, error: 'Image validation timeout' });
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      cleanup();
      
      // Check image dimensions
      if (img.width < 16 || img.height < 16) {
        resolve({ valid: false, error: 'Image must be at least 16x16 pixels' });
        return;
      }
      
      if (img.width > 512 || img.height > 512) {
        resolve({ valid: false, error: 'Image must be smaller than 512x512 pixels' });
        return;
      }
      
      resolve({ valid: true });
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ valid: false, error: 'Invalid or corrupted image file' });
    };
    
    img.src = url;
  });
};

// Simplified drag and drop hook
const useDragAndDrop = (badges: Badge[], setBadges: React.Dispatch<React.SetStateAction<Badge[]>>) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleBadgeDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newBadges = [...badges];
      const [draggedBadge] = newBadges.splice(draggedIndex, 1);
      newBadges.splice(dragOverIndex, 0, draggedBadge);
      setBadges(newBadges);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, badges, setBadges]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  return {
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleBadgeDragOver,
    handleDragEnd,
    handleDragLeave
  };
};

export const BadgeManager: React.FC<BadgeManagerProps> = ({
  badges,
  setBadges,
  isBadgeManagerOpen,
  setIsBadgeManagerOpen,
  saving,
  isTheme98
}) => {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState<Set<string>>(new Set());
  const [validationResults, setValidationResults] = useState<Map<string, {valid: boolean, error?: string}>>(new Map());
  const [previewMode, setPreviewMode] = useState<'grid' | 'list'>('grid');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDropRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const {
    newBadgeUrl,
    setNewBadgeUrl,
    newBadgeName,
    setNewBadgeName,
    addBadge,
    removeBadge,
    reorderBadges
  } = useBadgeManager({ badges, setBadges });

  const {
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleBadgeDragOver,
    handleDragEnd,
    handleDragLeave
  } = useDragAndDrop(badges, setBadges);

  // Enhanced image validation
  const validateNewBadge = useCallback(async (url: string) => {
    if (!url.trim()) return false;
    
    setImageLoading(prev => new Set(prev).add('new-badge'));
    
    try {
      // Basic URL validation
      try {
        new URL(url);
      } catch {
        setValidationResults(prev => new Map(prev).set('new-badge', { valid: false, error: 'Invalid URL format' }));
        return false;
      }

      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const isImageUrl = imageExtensions.some(ext => 
        url.toLowerCase().includes(ext)
      ) || url.includes('image') || url.includes('img');

      if (!isImageUrl) {
        setValidationResults(prev => new Map(prev).set('new-badge', { valid: false, error: 'URL must point to an image file' }));
        return false;
      }

      setValidationResults(prev => new Map(prev).set('new-badge', { valid: true }));
      return true;
    } catch (error) {
      console.error('Badge validation error:', error);
      setValidationResults(prev => new Map(prev).set('new-badge', { valid: false, error: 'Validation failed' }));
      return false;
    } finally {
      setImageLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete('new-badge');
        return newSet;
      });
    }
  }, []);

  // Enhanced add badge function
  const handleAddBadge = useCallback(async () => {
    const isValid = await validateNewBadge(newBadgeUrl);
    if (isValid) {
      addBadge();
      // Clear validation results after successful add
      setValidationResults(prev => {
        const newMap = new Map(prev);
        newMap.delete('new-badge');
        return newMap;
      });
    } else {
      const result = validationResults.get('new-badge');
      toast({
        title: "Invalid Badge",
        description: result?.error || "Please check the image URL",
        variant: "destructive"
      });
    }
  }, [newBadgeUrl, validateNewBadge, addBadge, validationResults, toast]);

  // Enhanced file upload handling
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if badge limit reached
    if (badges.length >= 10) {
      toast({
        title: "Badge Limit Reached",
        description: "Maximum 10 badges allowed per profile",
        variant: "destructive"
      });
      return;
    }

    try {
      const validation = await validateImageFile(file);
      
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        
        // Auto-add the badge with the uploaded image
        const newBadge = {
          id: `badge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: dataUrl,
          name: file.name.replace(/\.[^/.]+$/, "") // Remove file extension for name
        };
        
        setBadges(prev => [...prev, newBadge]);
        
        toast({
          title: "Badge Added",
          description: `"${newBadge.name}" has been added to your profile`,
          variant: "default"
        });

        // Clear the file input
        if (e.target) {
          e.target.value = '';
        }
      };
      reader.onerror = () => {
        toast({
          title: "Read Error",
          description: "Failed to read the image file",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload Error",
        description: "Failed to process the uploaded file",
        variant: "destructive"
      });
    }
  }, [badges.length, setBadges, toast]);

  // Enhanced drag and drop for file uploads
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "No Images Found",
        description: "Please drop image files (JPG, PNG, GIF, WebP, SVG)",
        variant: "destructive"
      });
      return;
    }

    if (imageFiles.length > 1) {
      toast({
        title: "Multiple Files",
        description: "Please drop one image at a time",
        variant: "destructive"
      });
      return;
    }

    // Check if badge limit reached
    if (badges.length >= 10) {
      toast({
        title: "Badge Limit Reached",
        description: "Maximum 10 badges allowed per profile",
        variant: "destructive"
      });
      return;
    }

    const file = imageFiles[0];
    
    try {
      const validation = await validateImageFile(file);
      
      if (!validation.valid) {
        toast({
          title: "Invalid Image",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      // If validation passes, process the file
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        
        // Auto-add the badge with the dropped image
        const newBadge = {
          id: `badge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url: dataUrl,
          name: file.name.replace(/\.[^/.]+$/, "") // Remove file extension for name
        };
        
        setBadges(prev => [...prev, newBadge]);
        
        toast({
          title: "Badge Added",
          description: `"${newBadge.name}" has been added to your profile`,
          variant: "default"
        });
      };
      
      reader.onerror = () => {
        toast({
          title: "Read Error",
          description: "Failed to read the image file",
          variant: "destructive"
        });
      };
      
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('File drop error:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process the dropped file",
        variant: "destructive"
      });
    }
  }, [badges.length, setBadges, toast]);

  // Image event handlers
  const handleImageError = useCallback((badgeId: string) => {
    setImageErrors(prev => new Set(prev).add(badgeId));
    setImageLoading(prev => {
      const newSet = new Set(prev);
      newSet.delete(badgeId);
      return newSet;
    });
  }, []);

  const handleImageLoad = useCallback((badgeId: string) => {
    setImageLoading(prev => {
      const newSet = new Set(prev);
      newSet.delete(badgeId);
      return newSet;
    });
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(badgeId);
      return newSet;
    });
  }, []);

  const handleImageLoadStart = useCallback((badgeId: string) => {
    setImageLoading(prev => new Set(prev).add(badgeId));
  }, []);

  // Badge selection management
  const toggleBadgeSelection = useCallback((badgeId: string) => {
    setSelectedBadges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(badgeId)) {
        newSet.delete(badgeId);
      } else {
        newSet.add(badgeId);
      }
      return newSet;
    });
  }, []);

  const selectAllBadges = useCallback(() => {
    setSelectedBadges(new Set(badges.map(badge => badge.id)));
  }, [badges]);

  const clearSelection = useCallback(() => {
    setSelectedBadges(new Set());
  }, []);

  const deleteSelectedBadges = useCallback(() => {
    selectedBadges.forEach(badgeId => removeBadge(badgeId));
    clearSelection();
    toast({
      title: "Badges Deleted",
      description: `${selectedBadges.size} badge(s) removed`
    });
  }, [selectedBadges, removeBadge, clearSelection, toast]);

  // Filter badges based on search
  const filteredBadges = badges.filter(badge =>
    badge.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    badge.url.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const getBrokenImageSrc = useCallback(() => {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNFYyNk0xNCAyMEgyNiIgc3Ryb2tlPSIjOTRBM0I4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4=';
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isBadgeManagerOpen) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'a':
            e.preventDefault();
            selectAllBadges();
            break;
          case 'Backspace':
          case 'Delete':
            e.preventDefault();
            if (selectedBadges.size > 0) {
              deleteSelectedBadges();
            }
            break;
        }
      }

      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBadgeManagerOpen, selectedBadges, selectAllBadges, deleteSelectedBadges, clearSelection]);

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-4",
      isTheme98 ? "sunken-panel" : ""
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">
            Badges ({badges.length}{badges.length >= 10 ? ' - Max reached' : '/10'})
          </h3>
          {selectedBadges.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600 dark:text-blue-400">
                {selectedBadges.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelectedBadges}
                disabled={saving}
              >
                Delete Selected
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={saving}
          >
            {showAdvanced ? 'Simple' : 'Advanced'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBadgeManagerOpen(!isBadgeManagerOpen)}
            disabled={saving}
          >
            {isBadgeManagerOpen ? 'Hide' : 'Manage'} Badges
          </Button>
        </div>
      </div>

      {/* Badge Preview */}
      {badges.length > 0 && (
        <div className={cn(
          "p-3 rounded border",
          isTheme98 ? "sunken-panel" : ""
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Badge Preview</div>
            <div className="flex gap-1">
              <Button
                variant={previewMode === 'grid' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('grid')}
                className="text-xs px-2 py-1"
              >
                Grid
              </Button>
              <Button
                variant={previewMode === 'list' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setPreviewMode('list')}
                className="text-xs px-2 py-1"
              >
                List
              </Button>
            </div>
          </div>
          
          <div className={cn(
            previewMode === 'grid' ? "grid grid-cols-6 gap-2" : "space-y-2"
          )}>
            {badges.map((badge, index) => (
              <div
                key={badge.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleBadgeDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
                onClick={() => toggleBadgeSelection(badge.id)}
                className={cn(
                  "relative group cursor-pointer transition-all duration-200",
                  previewMode === 'grid' ? "aspect-square" : "flex items-center gap-3 p-2 rounded",
                  isTheme98 ? "sunken-panel" : "rounded border",
                  selectedBadges.has(badge.id) && "ring-2 ring-blue-500",
                  dragOverIndex === index && "scale-105 shadow-lg",
                  draggedIndex === index && "opacity-50"
                )}
                title={badge.name || `Badge ${index + 1}`}
              >
                {imageLoading.has(badge.id) && (
                  <div className={cn(
                    "absolute flex items-center justify-center",
                    previewMode === 'grid' ? "inset-0" : "left-2 w-8 h-8"
                  )}>
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                <img
                  src={imageErrors.has(badge.id) ? getBrokenImageSrc() : badge.url}
                  alt={badge.name || `Badge ${index + 1}`}
                  className={cn(
                    "object-cover transition-opacity duration-200",
                    previewMode === 'grid' ? "w-full h-full rounded" : "w-8 h-8 rounded",
                    imageLoading.has(badge.id) && "opacity-0"
                  )}
                  onError={() => handleImageError(badge.id)}
                  onLoad={() => handleImageLoad(badge.id)}
                  onLoadStart={() => handleImageLoadStart(badge.id)}
                />
                
                {previewMode === 'list' && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {badge.name || `Badge ${index + 1}`}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {badge.url.length > 30 ? `${badge.url.substring(0, 30)}...` : badge.url}
                    </div>
                  </div>
                )}
                
              <div className={cn(
                "absolute bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                previewMode === 'grid' ? "inset-0 rounded" : "right-2 w-6 h-6 rounded"
              )}>
                <img
                  src="https://cdn.sekansh21.workers.dev/icons/cross.png"
                  alt="Remove badge"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBadge(badge.id);
                  }}
                  className="w-6 h-6 cursor-pointer hover:scale-110 transition-transform"
                  style={{ filter: saving ? 'grayscale(1) opacity(0.5)' : 'none', pointerEvents: saving ? 'none' : 'auto' }}
                />
              </div>
                
                {imageErrors.has(badge.id) && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bulk actions */}
          {showAdvanced && badges.length > 0 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selectAllBadges}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                Drag badges to reorder • Click to select • Ctrl+A to select all
              </div>
            </div>
          )}
        </div>
      )}

      {/* Badge Manager Panel */}
      {isBadgeManagerOpen && (
        <div className={cn(
          "p-4 border space-y-4",
          isTheme98 ? "sunken-panel" : ""
        )}>
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Add New Badge</h4>
            {badges.length > 0 && (
              <Input
                placeholder="Search badges..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-48 text-sm"
              />
            )}
          </div>
          
          {/* Enhanced Add Badge Form */}
          <div className="space-y-4">
            {/* URL Input */}
            <div>
              <Label htmlFor="badge-url">Badge Image URL</Label>
              <div className="relative">
                <Input
                  id="badge-url"
                  value={newBadgeUrl}
                  onChange={(e) => setNewBadgeUrl(e.target.value)}
                  placeholder="https://example.com/badge.png or drag & drop image"
                  disabled={saving}
                  className="text-sm pr-10"
                />
                {imageLoading.has('new-badge') && (
                  <div className="absolute right-3 top-2.5">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              
              {/* Validation feedback */}
              {validationResults.has('new-badge') && (
                <div className="mt-1 text-xs">
                  {validationResults.get('new-badge')?.valid ? (
                    <span className="text-green-600">✓ Valid image</span>
                  ) : (
                    <span className="text-red-600">✗ {validationResults.get('new-badge')?.error}</span>
                  )}
                </div>
              )}
            </div>

            {/* File Upload Zone */}
            <div
              ref={dragDropRef}
              onDragOver={handleFileDragOver}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "group border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
                "hover:border-blue-500",
                isTheme98 ? "border-gray-400" : "border-gray-300 dark:border-gray-600",
                badges.length >= 10 && "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={badges.length >= 10}
              />
              <div className="text-sm text-gray-600 transition-colors">
                <div className="mb-1">
                  {badges.length >= 10 ? "🚫 Badge limit reached" : "📁 Click to upload or drag & drop"}
                </div>
                <div className="text-xs">
                  {badges.length >= 10 
                    ? "Remove some badges to add new ones" 
                    : "Auto-adds badge • Supports: JPG, PNG, GIF, WebP, SVG (max 5MB)"
                  }
                </div>
              </div>
            </div>
            
            {/* Badge Name */}
            <div>
              <Label htmlFor="badge-name">Badge Name (Optional)</Label>
              <Input
                id="badge-name"
                value={newBadgeName}
                onChange={(e) => setNewBadgeName(e.target.value.slice(0, 30))}
                placeholder="Badge name for tooltip..."
                maxLength={30}
                disabled={saving}
                className="text-sm"
              />
              <div className="mt-1 text-xs text-gray-500">
                {newBadgeName.length}/30 - This appears as a tooltip when hovering over the badge
              </div>
            </div>
            
            {/* Add Button */}
            <Button
              onClick={handleAddBadge}
              disabled={saving || !newBadgeUrl.trim() || badges.length >= 10}
              size="sm"
              className="w-full"
            >
              {badges.length >= 10 ? 'Maximum badges reached (10/10)' : 'Add Badge'}
            </Button>
          </div>

          {/* Help text */}
          <div className="text-xs text-gray-500 space-y-1 pt-3 border-t">
            <p>• Badge images should be square (1:1 ratio) for best results</p>
            <p>• Maximum 10 badges allowed per profile</p>
            <p>• Use publicly accessible image URLs or upload your own</p>
            <p>• Recommended size: 64x64 pixels or larger</p>
            <p>• Images are automatically scaled and cropped to fit</p>
            <p>• Drag badges in the preview to reorder them</p>
          </div>
        </div>
      )}
    </div>
  );
};