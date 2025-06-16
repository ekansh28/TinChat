
// src/components/ProfileCustomizer/hooks/useBadgeManager.ts
import { useState, useCallback } from 'react';
import type { Badge } from '../types';

// Simple UUID generator
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface UseBadgeManagerProps {
  badges: Badge[];
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>;
}

interface UseBadgeManagerReturn {
  newBadgeUrl: string;
  setNewBadgeUrl: React.Dispatch<React.SetStateAction<string>>;
  newBadgeName: string;
  setNewBadgeName: React.Dispatch<React.SetStateAction<string>>;
  addBadge: () => void;
  removeBadge: (badgeId: string) => void;
  reorderBadges: (startIndex: number, endIndex: number) => void;
  clearAllBadges: () => void;
  duplicateBadge: (badgeId: string) => void;
}

export const useBadgeManager = ({
  badges,
  setBadges
}: UseBadgeManagerProps): UseBadgeManagerReturn => {
  const [newBadgeUrl, setNewBadgeUrl] = useState('');
  const [newBadgeName, setNewBadgeName] = useState('');

  const addBadge = useCallback(() => {
    if (!newBadgeUrl.trim() || badges.length >= 10) return;

    const newBadge: Badge = {
      id: generateUUID(),
      url: newBadgeUrl.trim(),
      name: newBadgeName.trim() || undefined
    };

    setBadges(prev => [...prev, newBadge]);
    setNewBadgeUrl('');
    setNewBadgeName('');
  }, [newBadgeUrl, newBadgeName, badges.length, setBadges]);

  const removeBadge = useCallback((badgeId: string) => {
    setBadges(prev => prev.filter(badge => badge.id !== badgeId));
  }, [setBadges]);

  const reorderBadges = useCallback((startIndex: number, endIndex: number) => {
    setBadges(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, [setBadges]);

  const clearAllBadges = useCallback(() => {
    setBadges([]);
    setNewBadgeUrl('');
    setNewBadgeName('');
  }, [setBadges]);

  const duplicateBadge = useCallback((badgeId: string) => {
    if (badges.length >= 10) return;

    const badgeToDuplicate = badges.find(badge => badge.id === badgeId);
    if (!badgeToDuplicate) return;

    const duplicatedBadge: Badge = {
      id: generateUUID(),
      url: badgeToDuplicate.url,
      name: badgeToDuplicate.name ? `${badgeToDuplicate.name} (Copy)` : undefined
    };

    setBadges(prev => [...prev, duplicatedBadge]);
  }, [badges, setBadges]);

  return {
    newBadgeUrl,
    setNewBadgeUrl,
    newBadgeName,
    setNewBadgeName,
    addBadge,
    removeBadge,
    reorderBadges,
    clearAllBadges,
    duplicateBadge
  };
};