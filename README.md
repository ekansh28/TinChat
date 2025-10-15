# TinChat

A modern real-time chat application designed for connecting people through text and video chat. Built with Next.js, Socket.IO, and integrated with Supabase authentication and database.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn package manager
- Supabase account for authentication and database
- Xata account for additional database features (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd TinChat
```

2. Install dependencies for both client and server:
```bash
# Install client dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

3. Environment Setup:
- Copy `.env.example` to `.env.local` and configure your environment variables
- Set up Supabase authentication and database
- Configure Xata database connection (if using)

Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Database Setup:
- Run the migration script in `supabase_migration.sql` in your Supabase SQL editor
- Enable authentication providers in Supabase Dashboard → Authentication
- Set redirect URLs to include `your_domain/auth/callback`

### Development

Start the development servers:

```bash
# Start the Next.js development server (port 9002)
npm run dev

# In another terminal, start the Socket.IO server
npm run server:dev
```

The application will be available at `http://localhost:9002`

### Building for Production

```bash
# Build the client
npm run build

# Build the server
cd server
npm run build
```

## 🏗️ Project Structure

```
TinChat/
├── src/                    # Next.js application source
│   ├── app/               # App router pages and layouts
│   ├── components/        # Reusable React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries and configurations
│   ├── styles/           # Global styles and CSS
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── server/                # Socket.IO server
│   ├── config/           # Server configuration
│   ├── managers/         # Connection and room managers
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   ├── types/            # Server type definitions
│   └── utils/            # Server utilities
├── public/               # Static assets
└── components.json       # shadcn/ui configuration
```

## 🛠️ Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Framer Motion** - Animations
- **Socket.IO Client** - Real-time communication

### Backend
- **Socket.IO** - Real-time bidirectional communication
- **Node.js** - Runtime environment
- **TypeScript** - Type safety

### Authentication & Database
- **Supabase Auth** - Authentication and user management
- **Supabase** - Primary database and real-time features
- **Xata** - Additional database features (optional)
- **Redis (ioredis)** - Caching and session management

### Additional Features
- **Vercel Analytics** - Performance monitoring
- **Sentry** - Error tracking
- **AWS S3** - File storage
- **Google Cloud Storage** - Additional file storage

## 🎨 For Designers

### Design System
- Uses **shadcn/ui** components with Radix UI primitives
- **Tailwind CSS** for consistent styling
- **98.css** theme available for retro styling
- Custom theme provider supporting multiple themes

### Key Design Files
- `src/styles/globals.css` - Global styles and CSS variables
- `tailwind.config.ts` - Tailwind configuration
- `src/components/theme-provider.tsx` - Theme management

### Component Library
All UI components are located in `src/components/` and follow shadcn/ui patterns:
- Consistent API design
- Accessible by default
- Customizable with CSS variables
- TypeScript support

## 🔧 Development Scripts

### Client Scripts
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

### Server Scripts
```bash
npm run server:dev   # Start server in development mode
cd server && npm run dev    # Alternative server dev command
cd server && npm run build  # Build server for production
```

### AI/Genkit Scripts
```bash
npm run genkit:dev   # Start Genkit development server
npm run genkit:watch # Start Genkit with file watching
```

## 📦 Key Dependencies

### UI & Styling
- `@radix-ui/*` - Accessible UI primitives
- `tailwindcss` - Utility-first CSS framework
- `framer-motion` - Animation library
- `lucide-react` - Icon library

### Real-time & Communication
- `socket.io` - Real-time communication
- `socket.io-client` - Client-side Socket.IO

### State Management & Data
- `@tanstack/react-query` - Server state management
- `react-hook-form` - Form handling
- `zod` - Schema validation

### Authentication & Database
- `@supabase/auth-helpers-nextjs` - Supabase authentication for Next.js
- `@supabase/auth-helpers-react` - React hooks for Supabase auth
- `@supabase/auth-ui-react` - Pre-built auth UI components
- `@supabase/supabase-js` - Supabase client
- `@xata.io/client` - Xata database client

## 🚀 Deployment

The application is configured for deployment on Vercel with the following setup:
- Next.js application on Vercel
- Socket.IO server can be deployed separately
- Supabase handles authentication and database hosting
- Environment variables configured for production
- CSP headers configured for security

### Supabase Setup for Production:
1. Create a Supabase project
2. Run the migration script from `supabase_migration.sql`
3. Configure authentication providers
4. Set production redirect URLs
5. Add environment variables to your deployment platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🔄 Migration from Clerk to Supabase Auth

This project has been migrated from Clerk to Supabase authentication. Key benefits:

### **Why Supabase Auth?**
- **Cost-effective**: No per-user pricing limits
- **Integrated**: Authentication and database in one platform
- **Open source**: Full control and transparency
- **Feature-rich**: Built-in OAuth, email verification, and more

### **Migration Status**
- ✅ Database schema updated with Supabase auth integration
- ✅ Authentication components converted to Supabase
- ✅ Middleware updated for session management
- ✅ Row Level Security (RLS) policies implemented
- ✅ Automatic user profile creation on signup

### **For Developers**
- Check `MIGRATION_TO_SUPABASE_AUTH.md` for detailed migration notes
- Run `supabase_migration.sql` to set up the database schema
- Update any remaining Clerk references in custom components

---

For more detailed documentation on specific features, check the migration guide `MIGRATION_TO_SUPABASE_AUTH.md` or refer to the inline code comments.
