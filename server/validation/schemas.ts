// server/validation/schemas.ts
import { z } from 'zod';

// Common validation helpers
const StringArraySchema = z.array(z.string().max(100)).max(10);
const RoomIdSchema = z.string().regex(/^[a-zA-Z0-9#-_]+$/).max(100);
const AuthIdSchema = z.string().uuid().nullable().optional().default(null);

export const ValidationSchemas = {
  // Find partner payload validation
  FindPartnerPayloadSchema: z.object({
    chatType: z.enum(['text', 'video']),
    interests: StringArraySchema,
    authId: AuthIdSchema,
  }),

  // Room ID validation for various operations
  RoomIdPayloadSchema: z.object({
    roomId: RoomIdSchema,
  }),

  // Message sending validation
  SendMessagePayloadSchema: z.object({
    roomId: RoomIdSchema,
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
    status: z.enum(['online', 'idle', 'dnd', 'offline']),
  }),

  // Typing indicator validation
  TypingPayloadSchema: z.object({
    roomId: RoomIdSchema,
  }),

  // User profile validation
  UserProfileSchema: z.object({
    id: z.string().uuid(),
    username: z.string().min(3).max(20),
    display_name: z.string().max(32).optional(),
    avatar_url: z.string().url().optional(),
    banner_url: z.string().url().optional(),
    pronouns: z.string().max(20).optional(),
    status: z.enum(['online', 'idle', 'dnd', 'offline']).optional(),
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

  // Room creation validation
  CreateRoomSchema: z.object({
    roomId: RoomIdSchema,
    users: z.array(z.string()).min(2).max(2), // Exactly 2 users for 1-on-1 chat
    chatType: z.enum(['text', 'video']),
    metadata: z.object({
      commonInterests: z.array(z.string()).optional(),
      userProfiles: z.record(z.any()).optional(),
    }).optional(),
  }),

  // Interest validation
  InterestSchema: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Interest can only contain letters, numbers, spaces, hyphens, and underscores'),

  // Chat message validation with enhanced features
  ChatMessageSchema: z.object({
    id: z.string(),
    content: z.string().min(1).max(2000),
    senderId: z.string(),
    senderUsername: z.string().max(30).optional(),
    senderAuthId: AuthIdSchema,
    timestamp: z.number(),
    roomId: RoomIdSchema,
    messageType: z.enum(['text', 'image', 'file', 'system']).default('text'),
    metadata: z.object({
      senderDisplayNameColor: z.string().optional(),
      senderDisplayNameAnimation: z.string().optional(),
      senderRainbowSpeed: z.number().optional(),
      editedAt: z.number().optional(),
      replyTo: z.string().optional(),
    }).optional(),
  }),

  // Rate limiting validation
  RateLimitSchema: z.object({
    action: z.enum(['findPartner', 'sendMessage', 'typing', 'statusUpdate']),
    userId: z.string(),
    timestamp: z.number(),
    count: z.number().min(0),
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

  static validateUsername(username: string): { valid: boolean; error?: string } {
    const trimmed = username.trim();
    
    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters long' };
    }
    
    if (trimmed.length > 20) {
      return { valid: false, error: 'Username must be no more than 20 characters long' };
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }
    
    return { valid: true };
  }

  static validateDisplayName(displayName: string): { valid: boolean; error?: string } {
    const trimmed = displayName.trim();
    
    if (trimmed.length === 0) {
      return { valid: true }; // Display name is optional
    }
    
    if (trimmed.length > 32) {
      return { valid: false, error: 'Display name must be no more than 32 characters long' };
    }
    
    return { valid: true };
  }

  static validateBio(bio: string): { valid: boolean; error?: string } {
    const trimmed = bio.trim();
    
    if (trimmed.length === 0) {
      return { valid: true }; // Bio is optional
    }
    
    if (trimmed.length > 500) {
      return { valid: false, error: 'Bio must be no more than 500 characters long' };
    }
    
    return { valid: true };
  }

  static sanitizeMessage(message: string): string {
    return message
      .trim()
      .substring(0, 2000) // Ensure max length
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  static validateColorHex(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Validation middleware factory
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; error: string } => {
    try {
      const validatedData = schema.parse(data);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        return { success: false, error: errorMessage };
      }
      return { success: false, error: 'Validation failed' };
    }
  };
}