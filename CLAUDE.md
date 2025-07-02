# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start development server** (with hot reloading):
```bash
deno task dev
```

**Deploy to Deno Deploy**:
```bash
deno task deploy
```

**Run directly** (without hot reloading):
```bash
deno run --allow-net --allow-read --allow-env main.ts
```

**Access the application**: http://localhost:8001

## Architecture Overview

This is a **Hangman game** built with **Deno** and **TypeScript** using:
- **Effection** for structured concurrency and server management
- **Server-side rendering** with HTML templates
- **Session-based state management** using HTTP cookies
- **Functional programming patterns** with immutable data structures

### Key Architecture Components

- **Entry point**: `main.ts` - Sets up HTTP server with routing and graceful shutdown
- **Game Logic**: `src/state/game.ts` - Immutable game state with functional operations
- **Session Management**: `src/state/session.ts` - In-memory session storage using Map
- **Routing**: `src/routes/router.ts` + `src/routes/handlers.ts` - Custom URLPattern-based routing
- **Type Safety**: `src/types.ts` - Strong TypeScript typing with discriminated unions
- **Error Handling**: `src/utils/result.ts` - Functional Result type (no exceptions)

### Game State Architecture

Game states flow through these phases:
- `"playing"` → user makes guesses
- `"won"` → word completed successfully  
- `"lost"` → 7 incorrect guesses reached

Sessions are stored in-memory and persist game state across HTTP requests using secure cookies.

### Word Lists and Categories

Word data is in `src/data/wordLists.ts` with three categories (General, Animals, Countries) and three difficulty levels (easy, medium, hard) per category.

### Frontend Architecture

- **No build step** - TypeScript compiled at runtime by Deno
- **Server-side templates** in `src/views/home.ts` generate dynamic HTML
- **Static assets** served from `src/static/` (CSS, JS, images)
- **HTMX** for AJAX interactions without full page reloads
- **Keyboard navigation** implemented in `src/static/keyboard.js`

## Project Structure Notes

- **No package.json** - Uses Deno's native package management via `deno.json`
- **No test files** - Testing setup not implemented
- **Deployment ready** - Configured for Deno Deploy serverless platform
- **Port configuration** - Uses PORT environment variable (defaults to 8001)

## Common Development Patterns

- **Immutable data** - All game state uses `readonly` properties
- **Pure functions** - Game operations return new state rather than mutating
- **Type-driven development** - Extensive use of TypeScript's type system
- **Result-based error handling** - Explicit error types instead of exceptions
- **Session isolation** - Each user session maintains independent game state