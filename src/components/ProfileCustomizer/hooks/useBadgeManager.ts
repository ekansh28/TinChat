// src/components/ProfileCustomizer/hooks/useBadgeManager.ts
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { validateImageUrl } from '../utils/fileHandlers';
import type { Badge } from '../types';

// Simple UUID generator using crypto.randomUUID() or fallback
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'badge-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
};

interface UseBadgeManagerProps {
  badges: Badge[];
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>;
}

export const useBadgeManager = ({ badges, setBadges }: UseBadgeManagerProps) => {
  const [newBadgeUrl, setNewBadgeUrl] = useState('');
  const [newBadgeName, setNewBadgeName] = useState('');
  const { toast } = useToast();

  const addBadge = () => {
    if (!newBadgeUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL"
      });
      return;
    }

    if (badges.length >= 10) {
      toast({
        title: "Maximum badges reached",
        description: "You can only have up to 10 badges"
      });
      return;
    }

    const validation = validateImageUrl(newBadgeUrl);
    if (!validation.valid) {
      toast({
        title: "Invalid Image",
        description: validation.error
      });
      return;
    }

    const newBadge: Badge = {
      id: generateId(),
      url: newBadgeUrl.trim(),
      name: newBadgeName.trim() || `Badge ${badges.length + 1}`
    };

    setBadges(prev => [...prev, newBadge]);
    setNewBadgeUrl('');
    setNewBadgeName('');
    
    toast({
      title: "Badge Added",
      description: "Badge has been added to your profile"
    });
  };

  const removeBadge = (badgeId: string) => {
    setBadges(prev => prev.filter(badge => badge.id !== badgeId));
    toast({
      title: "Badge Removed",
      description: "Badge has been removed from your profile"
    });
  };

  const updateBadge = (badgeId: string, updates: Partial<Badge>) => {
    setBadges(prev => prev.map(badge => 
      badge.id === badgeId ? { ...badge, ...updates } : badge
    ));
  };

  const reorderBadges = (startIndex: number, endIndex: number) => {
    setBadges(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  return {
    newBadgeUrl,
    setNewBadgeUrl,
    newBadgeName,
    setNewBadgeName,
    addBadge,
    removeBadge,
    updateBadge,
    reorderBadges,
  };
};