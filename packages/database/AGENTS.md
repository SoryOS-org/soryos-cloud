# `@soryos/database` Agent Operating Guidelines

## Overview
This package provides a real-time database with subscription support for SoryOS-Cloud. Inspired by Vibra Code's Convex implementation but adapted to SoryOS architecture.

## Responsibilities
- Provide `RealTimeDatabase` interface and implementation
- Manage session state with real-time updates
- Handle message persistence and streaming
- Support subscription-based real-time updates
- Validate data with Zod schemas
- Maintain data consistency across sessions

## Key Files
- `src/index.ts`: Main exports (RealTimeDatabase, SessionManager, MessageManager)
- `src/realtime.ts`: Real-time database implementation with in-memory storage
- `src/sessions.ts`: SessionManager with full lifecycle management
- `src/messages.ts`: MessageManager with streaming support
- `src/subscriptions.ts`: SubscriptionManager for real-time updates
- `src/schema.ts`: Zod schema definitions for all database entities
- `src/types.ts`: TypeScript type definitions

## Architecture
```
RealTimeDatabase
├── SessionManager (manages Session lifecycle)
├── MessageManager (handles chat messages with streaming)
├── SubscriptionManager (real-time updates)
└── Schema (Zod validation)
```

## Agent Guidelines
- Use `SessionManager` for all session operations
- Use `MessageManager` for message persistence and streaming
- Subscribe to real-time updates using `SubscriptionManager`
- Validate all inputs using Zod schemas from `schema.ts`
- Never bypass database validation
- Handle subscription cleanup on session end

## Real-Time Features
- Session subscriptions: Get notified when session state changes
- Message subscriptions: Receive new messages in real-time
- Broadcast support: Send updates to all subscribers
- Automatic cleanup: Remove subscriptions when no longer needed

## Data Models
- **Session**: Complete session state including status, workspace, environment
- **Message**: Chat messages with role, content, tool calls, attachments
- **Job**: Background job tracking with status and results
- **Subscription**: Real-time subscription management

## Session Status Flow
```
pending → initializing → ready → active → pausing → paused → resuming → active → terminating → terminated
         ↓                          ↓
        error                      destroyed
```

All transitions are validated in `sessions.ts`
