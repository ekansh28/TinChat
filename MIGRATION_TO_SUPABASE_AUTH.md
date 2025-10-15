# Migration from Clerk to Supabase Auth

This document outlines the completed migration from Clerk authentication to Supabase Auth.

## Changes Made

### 1. Database Schema Updates
- Created `supabase_migration.sql` with necessary schema changes
- Added `auth_id` column to `user_profiles` table referencing `auth.users.id`
- Set up Row Level Security (RLS) policies for data protection
- Created automatic user profile creation trigger
- **Action Required**: Run the migration SQL in your Supabase dashboard

### 2. Dependencies Updated
- **Removed**: Clerk packages (`@clerk/nextjs`, `@clerk/backend`, etc.)
- **Added**: Supabase auth helpers and UI packages
- Updated `package.json` with new dependencies

### 3. Core Files Updated

#### Authentication Setup
- `src/lib/supabase.ts` - Supabase client configuration with TypeScript types
- `src/providers/SupabaseProvider.tsx` - Supabase auth context provider
- `src/app/layout.tsx` - Updated to use SupabaseProvider instead of ClerkProvider

#### Authentication Components
- `src/components/AuthButtonsSupabase.tsx` - New auth buttons component for Supabase
- `src/components/AuthModalSupabase.tsx` - New auth modal with Supabase Auth UI
- `src/app/chat/hooks/useAuth.ts` - Updated to use Supabase auth instead of Clerk

#### Routing & Middleware
- `src/middleware.ts` - Updated to use Supabase middleware for session management
- `src/app/auth/callback/route.ts` - OAuth callback handler for Supabase

## Environment Variables Required

Make sure these are set in your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Setup

1. **Run Migration**: Execute the SQL in `supabase_migration.sql` in your Supabase SQL editor

2. **Enable Authentication**: In Supabase Dashboard → Authentication:
   - Enable Email/Password authentication
   - Enable OAuth providers (Google, GitHub, Discord) if desired
   - Set Site URL to your domain
   - Set Redirect URLs to include `your_domain/auth/callback`

## Key Differences from Clerk

### Authentication Flow
- **Clerk**: Used `useUser()` and `useClerk()` hooks
- **Supabase**: Uses `useUser()` and `useSupabaseClient()` from auth helpers

### User Data
- **Clerk**: User data directly from Clerk with custom profile data
- **Supabase**: User data from `auth.users` + custom profile in `user_profiles` table

### Session Management
- **Clerk**: Automatic session management
- **Supabase**: Sessions managed via auth helpers with server-side refresh

## Next Steps

1. **Test Authentication**:
   - Start the development server
   - Test sign up/sign in flows
   - Verify user profile creation
   - Test OAuth providers

2. **Update Server Components**:
   - Update any server-side authentication in API routes
   - Replace Clerk webhook handlers with Supabase Auth webhooks if needed

3. **Clean Up**:
   - Remove old Clerk-specific files once migration is verified
   - Update any remaining Clerk references in other components

## Files That May Need Updates

These existing files likely still contain Clerk references and should be updated:

- `src/components/AuthButtons.tsx` (replace with AuthButtonsSupabase.tsx)
- `src/components/AuthModal.tsx` (replace with AuthModalSupabase.tsx)
- API routes in `src/app/api/` that use Clerk authentication
- Any other components using `useUser()` from Clerk

## Testing Checklist

- [ ] User can sign up with email/password
- [ ] User can sign in with email/password
- [ ] OAuth providers work (if enabled)
- [ ] User profile is automatically created
- [ ] Protected routes redirect unauthenticated users
- [ ] User can sign out successfully
- [ ] Profile data loads correctly in chat
- [ ] Real-time features work with new auth

## Rollback Plan

If issues occur, you can rollback by:
1. Reverting to Clerk dependencies in package.json
2. Restoring original auth files
3. Using the original layout.tsx with ClerkProvider

The database changes are additive and won't break existing Clerk functionality.