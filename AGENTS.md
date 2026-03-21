# SolHunt Recovery — Agent Guide

## Project Context
A React/Vite Solana utility app for wallet recovery, security, and optimization.
Built by AI, now being actively maintained by Zo agents to build commit history and improve quality.

## Agent Role
Act as a senior React/Solana engineer. Focus on:
- Code quality improvements
- UI/UX polish
- Performance optimizations
- Security hardening
- Staying current with Solana ecosystem updates
- Making frequent, small commits to build project history

## Directory Structure
```
src/
  components/      # Shared UI components
  hooks/          # React hooks for business logic
  lib/            # Utility functions, transaction builders
  modules/        # Self-contained engine modules (lp-harvester, cnft-cleaner, etc.)
  pages/          # Route-level page components
  config/         # Constants, Solana config
  types/          # TypeScript types
```

## Development Patterns
- Use TypeScript strictly
- Prefer small, focused commits
- Update imports to use `@/` path aliases
- Keep transaction builders isolated and auditable
- Add loading states and error boundaries
- Use Zustand for state management

## Blockchain Integration
- Helius RPC for data
- Jupiter V6 for swaps
- Direct program IDL calls for protocol interactions
- Never request persistent wallet authority

## Current Priorities
1. Build commit history with incremental improvements
2. Audit and harden transaction builders
3. Improve UI responsiveness and accessibility
4. Add better error handling
5. Keep dependencies updated
