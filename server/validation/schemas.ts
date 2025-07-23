// server/validation/schemas.ts - FIXED VALIDATION
import { z } from 'zod';
import { UserStatus } from '../types/User';

// ✅ CRITICAL FIX: More flexible validation schemas
const StringArraySchema = z.array(z.string().max(100)).max(10);

// ✅ FIXED: More flexible roomId validation to accept generated room IDs
const RoomIdSchema = z.string().min(1).max(200); // Accept any non-empty string up to 200 chars

const AuthIdSchema = z.string().nullable().optional().default(null);

// Create a Zod enum from the UserStatus type
const UserStatusSchema = z.enum(['online', 'idle', 'dnd', 'offline'] as const);

export const ValidationSchemas = {
  // Find partner payload validation
  FindPartnerPayloadSchema: z.object({
    chatType: z.enum(['text', 'video']),
    interests: StringArraySchema,
    authId: AuthIdSchema,
  }),

  // ✅ FIXED: More flexible room ID validation
  RoomIdPayloadSchema: z.object({
    roomId: RoomIdSchema,
  }),

  // ✅ CRITICAL FIX: More flexible message validation
  SendMessagePayloadSchema: z.object({
    roomId: z.string().optional().default(''), // ✅ Make roomId optional with default
    message: z.string().min(1).max(2000),
    username: z.string().max(30).nullable().optional(),
    authId: AuthIdSchema,
  }),

  // WebRTC signaling validation
  WebRTCSignalPayloadSchema: z.object({
    roomId: RoomIdSchema,
    signalData: z.any(),
  }),

  // Status update validation
  UpdateStatusPayloadSchema: z.object({
    status: UserStatusSchema,
  }),

  // ✅ FIXED: More flexible typing validation
  TypingPayloadSchema: z.object({
    roomId: z.string().optional().default(''), // ✅ Make optional
  }),

  // User profile validation
  UserProfileSchema: z.object({
    id: z.string().min(1), // ✅ More flexible ID validation
    username: z.string().min(3).max(20),
    display_name: z.string().max(32).optional(),
    avatar_url: z.string().url().optional(),
    banner_url: z.string().url().optional(),
    pronouns: z.string().max(20).optional(),
    status: UserStatusSchema.optional(),
    display_name_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    display_name_animation: z.enum(['none', 'rainbow', 'gradient', 'pulse', 'glow']).optional(),
    rainbow_speed: z.number().min(1).max(10).optional(),
    bio: z.string().max(500).optional(),
    badges: z.array(z.object({
      id: z.string(),
      url: z.string().url(),
      name: z.string().optional()
    })).max(10).optional(),
  }),
};

// Custom validation functions
export class ValidationHelpers {
  static validateInterests(interests: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (interests.length > 10) {
      errors.push('Maximum 10 interests allowed');
    }
    
    const uniqueInterests = new Set(interests.map(i => i.toLowerCase().trim()));
    if (uniqueInterests.size !== interests.length) {
      errors.push('Duplicate interests are not allowed');
    }
    
    interests.forEach((interest, index) => {
      const trimmed = interest.trim();
      if (trimmed.length === 0) {
        errors.push(`Interest at position ${index + 1} is empty`);
      } else if (trimmed.length > 50) {
        errors.push(`Interest "${trimmed}" is too long (max 50 characters)`);
      } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
        errors.push(`Interest "${trimmed}" contains invalid characters`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  static sanitizeMessage(message: string): string {
    return message
      .trim()
      .substring(0, 2000) // Ensure max length
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
}