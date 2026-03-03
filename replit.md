# EduManage - Academic Management System

## Overview

EduManage is a web-based academic management platform (Sistema de Gestão Acadêmica) designed for educational institutions. It provides role-based access for three user types: **Admins**, **Teachers (Professors)**, and **Students (Alunos)**. Core features include user management, course/discipline management, student enrollment, grade and attendance tracking, and an announcement board. The interface is in Portuguese (Brazilian) with some English mixed in. The app runs on port 5000 with a unified dev server.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure
The project uses a three-folder monorepo pattern:
- **`client/`** — React SPA (Single Page Application)
- **`server/`** — Express.js API server
- **`shared/`** — Shared TypeScript types, database schema, and API route contracts

This structure allows the frontend and backend to share type definitions and validation schemas, ensuring type safety across the stack.

### Frontend (`client/`)
- **Framework:** React with TypeScript
- **Routing:** Wouter (lightweight client-side router)
- **State/Data Fetching:** TanStack React Query for server state management
- **UI Components:** shadcn/ui component library (New York style) built on Radix UI primitives
- **Styling:** Tailwind CSS with CSS variables for theming (indigo-slate academic palette)
- **Forms:** React Hook Form with Zod validation via `@hookform/resolvers`
- **Charts:** Recharts for dashboard analytics
- **Fonts:** DM Sans (body) and Outfit (display headings)
- **Build Tool:** Vite with React plugin

Pages include: Login, Dashboard, Courses list, Course detail, Students directory, Announcements.

Protected routes redirect unauthenticated users to the login page. The `LayoutShell` component provides sidebar navigation filtered by user role.

### Backend (`server/`)
- **Framework:** Express.js (v5) running on Node with tsx
- **Authentication:** Passport.js with Local Strategy, using express-session for session management
- **Password Hashing:** Node.js `crypto.scrypt` with random salt
- **API Design:** RESTful JSON API under `/api/*` prefix
- **Storage Layer:** `IStorage` interface implemented by `DatabaseStorage` class, providing a clean abstraction over database operations
- **Seeding:** Automatic database seeding on first run with test users (admin/teacher/student, all with password `password123`)

The server serves the Vite dev server in development mode and static built files in production. The catch-all route serves `index.html` for SPA client-side routing.

### Shared (`shared/`)
- **`schema.ts`** — Drizzle ORM table definitions and Zod insert schemas for: `users`, `courses`, `enrollments`, `announcements` with relations
- **`routes.ts`** — Typed API contract definitions using Zod schemas, defining method, path, input validation, and response schemas for all endpoints

This shared contract pattern means both client and server reference the same route paths and validation logic, reducing drift.

### Database
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **Database:** PostgreSQL (provisioned via Replit, connection via `DATABASE_URL` environment variable)
- **Schema Management:** `drizzle-kit push` for schema synchronization (no migration files needed for development)
- **Tables:**
  - `users` — id, username, password (hashed), role (admin/teacher/student), name, email, createdAt
  - `courses` — id, name, description, teacherId (FK to users), schedule
  - `enrollments` — id, studentId (FK), courseId (FK), enrolledAt, grade (0-100), attendance (0-100%)
  - `announcements` — id, title, content, authorId (FK), courseId (nullable FK for global vs course-specific), createdAt

### Authentication & Authorization
- Session-based auth using `express-session` (cookie-based, 1-day expiry)
- Passport Local Strategy for username/password login
- Role-based access control with three roles: `admin`, `teacher`, `student`
- Frontend nav items filtered by role; backend should enforce role checks on sensitive endpoints
- Password change functionality available to authenticated users

### Key API Endpoints
- `POST /api/login` — Authenticate user
- `POST /api/logout` — End session
- `GET /api/user` — Get current authenticated user
- `POST /api/change-password` — Change password
- `GET /api/users` — List users (filterable by role)
- `GET/POST /api/courses` — List/create courses
- `GET/PUT /api/courses/:id` — Get/update specific course
- `GET/POST /api/enrollments` — List/create enrollments
- `PUT /api/enrollments/:id` — Update enrollment (grades/attendance)
- `GET/POST /api/announcements` — List/create announcements

### Build & Development
- **Dev:** `npm run dev` runs tsx to start the Express server which sets up Vite middleware for HMR
- **Build:** `npm run build` runs a custom build script that uses Vite for the client and esbuild for the server, outputting to `dist/`
- **Production:** `npm start` runs the built Node.js server serving static client files

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable using `pg` (node-postgres) pool

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and schema management
- **express** (v5) — HTTP server
- **passport** + **passport-local** — Authentication
- **express-session** — Session management
- **@tanstack/react-query** — Client-side data fetching and caching
- **zod** + **drizzle-zod** — Schema validation (shared between client and server)
- **recharts** — Dashboard charts
- **react-hook-form** — Form management
- **wouter** — Client-side routing
- **shadcn/ui** (Radix UI primitives) — UI component library
- **tailwindcss** — Utility-first CSS framework
- **vite** — Frontend build tool and dev server

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` — Error overlay in development
- `@replit/vite-plugin-cartographer` — Dev tooling (dev only)
- `@replit/vite-plugin-dev-banner` — Dev banner (dev only)

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string (required)
- `SESSION_SECRET` — Session encryption secret (falls back to `"default_secret"`)