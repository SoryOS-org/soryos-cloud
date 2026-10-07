/**
 * @soryos/database
 * Real-time Database Implementation
 * 
 * Inspired by Vibra Code's Convex real-time system
 * Provides real-time synchronization for SoryOS-Cloud
 */

import { Session, Message, MessageRole, SessionStatus, DatabaseEvent, DatabaseEventType, Subscription, SubscriptionOptions } from './types';

// ============================================================================
// Real-time Database Interface
// ============================================================================

export interface RealTimeDatabase {
  // Session operations
  createSession(session: Omit<Session, '_id' | '_creationTime' | 'id'>): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  listSessions(options?: { createdBy?: string; limit?: number }): Promise<Session[]>;
  
  // Message operations
  addMessage(message: Omit<Message, '_id' | '_creationTime' | 'id'>): Promise<Message>;
  getMessage(id: string): Promise<Message | null>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
  listMessages(sessionId: string, options?: { limit?: number; order?: 'asc' | 'desc' }): Promise<Message[]>;
  
  // Subscriptions
  subscribeToSession(sessionId: string, callback: (session: Session | null) => void): Subscription;
  subscribeToMessages(sessionId: string, callback: (messages: Message[]) => void): Subscription;
  subscribeToEvents(callback: (event: DatabaseEvent) => void): Subscription;
  
  // Real-time streaming
  onMessageAdded(callback: (message: Message) => void): Subscription;
  onMessageUpdated(callback: (message: Message) => void): Subscription;
  onSessionUpdated(callback: (session: Session) => void): Subscription;
  
  // Event emitter
  emitEvent(type: DatabaseEventType, data?: any): void;
  onEvent(type: DatabaseEventType, callback: (event: DatabaseEvent) => void): Subscription;
}

// ============================================================================
// In-Memory Real-time Database (for development/testing)
// ============================================================================

class InMemoryRealTimeDatabase implements RealTimeDatabase {
  private sessions: Map<string, Session> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private sessionSubscriptions: Map<string, Set<(session: Session | null) => void>> = new Map();
  private messageSubscriptions: Map<string, Set<(messages: Message[]) => void>> = new Map();
  private eventListeners: Map<DatabaseEventType, Set<(event: DatabaseEvent) => void>> = new Map();
  private messageAddedListeners: Set<(message: Message) => void> = new Set();
  private messageUpdatedListeners: Set<(message: Message) => void> = new Set();
  private sessionUpdatedListeners: Set<(session: Session) => void> = new Set();

  constructor() {
    // Initialize event types
    const eventTypes: DatabaseEventType[] = [
      'message.added',
      'message.updated',
      'message.removed',
      'session.created',
      'session.updated',
      'session.removed',
      'error'
    ];
    
    eventTypes.forEach(type => {
      this.eventListeners.set(type, new Set());
    });
  }

  // ==========================================================================
  // Session Operations
  // ==========================================================================

  async createSession(sessionData: Omit<Session, '_id' | '_creationTime' | 'id'>): Promise<Session> {
    const id = this.generateId();
    const session: Session = {
      ...sessionData,
      _id: id as any,
      _creationTime: Date.now(),
      id,
      status: sessionData.status || 'IN_PROGRESS',
      totalCostUSD: sessionData.totalCostUSD || 0,
      messageCount: sessionData.messageCount || 0,
      lastCostUpdate: sessionData.lastCostUpdate || Date.now(),
    };

    this.sessions.set(id, session);
    this.emitEvent('session.created', session);
    
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const updatedSession = { ...session, ...updates, _id: session._id };
    this.sessions.set(id, updatedSession);
    
    this.emitEvent('session.updated', updatedSession);
    this.sessionUpdatedListeners.forEach(callback => callback(updatedSession));
    
    // Notify session subscribers
    const callbacks = this.sessionSubscriptions.get(id);
    callbacks?.forEach(callback => callback(updatedSession));

    return updatedSession;
  }

  async deleteSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    this.sessions.delete(id);
    this.emitEvent('session.removed', { id });
    
    // Notify session subscribers
    const callbacks = this.sessionSubscriptions.get(id);
    callbacks?.forEach(callback => callback(null));
    this.sessionSubscriptions.delete(id);
  }

  async listSessions(options?: { createdBy?: string; limit?: number }): Promise<Session[]> {
    let sessions = Array.from(this.sessions.values());
    
    if (options?.createdBy) {
      sessions = sessions.filter(s => s.createdBy === options.createdBy);
    }
    
    if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }
    
    return sessions.sort((a, b) => b._creationTime - a._creationTime);
  }

  // ==========================================================================
  // Message Operations
  // ==========================================================================

  async addMessage(messageData: Omit<Message, '_id' | '_creationTime' | 'id'>): Promise<Message> {
    const id = this.generateId();
    const message: Message = {
      ...messageData,
      _id: id as any,
      _creationTime: Date.now(),
      id,
      createdAt: Date.now(),
    };

    // Add to messages map
    if (!this.messages.has(messageData.sessionId)) {
      this.messages.set(messageData.sessionId, []);
    }
    const sessionMessages = this.messages.get(messageData.sessionId)!;
    sessionMessages.push(message);
    
    // Update session message count
    const session = this.sessions.get(messageData.sessionId);
    if (session) {
      await this.updateSession(messageData.sessionId, {
        messageCount: (session.messageCount || 0) + 1,
      });
    }

    this.emitEvent('message.added', message);
    this.messageAddedListeners.forEach(callback => callback(message));
    
    // Notify message subscribers for this session
    const callbacks = this.messageSubscriptions.get(messageData.sessionId);
    if (callbacks) {
      const messages = this.messages.get(messageData.sessionId) || [];
      callbacks.forEach(callback => callback([...messages]));
    }

    return message;
  }

  async getMessage(id: string): Promise<Message | null> {
    for (const [, messages] of this.messages) {
      const message = messages.find(m => m.id === id || m._id === id);
      if (message) return message;
    }
    return null;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message> {
    let updatedMessage: Message | null = null;
    
    for (const [sessionId, messages] of this.messages) {
      const index = messages.findIndex(m => m.id === id || m._id === id);
      if (index !== -1) {
        const message = messages[index];
        updatedMessage = { ...message, ...updates, _id: message._id };
        messages[index] = updatedMessage;
        
        this.emitEvent('message.updated', updatedMessage);
        this.messageUpdatedListeners.forEach(callback => callback(updatedMessage));
        
        // Notify message subscribers for this session
        const callbacks = this.messageSubscriptions.get(sessionId);
        if (callbacks) {
          callbacks.forEach(callback => callback([...messages]));
        }
        break;
      }
    }

    if (!updatedMessage) {
      throw new Error(`Message ${id} not found`);
    }

    return updatedMessage;
  }

  async deleteMessage(id: string): Promise<void> {
    for (const [sessionId, messages] of this.messages) {
      const index = messages.findIndex(m => m.id === id || m._id === id);
      if (index !== -1) {
        messages.splice(index, 1);
        this.emitEvent('message.removed', { id });
        
        // Notify message subscribers for this session
        const callbacks = this.messageSubscriptions.get(sessionId);
        if (callbacks) {
          callbacks.forEach(callback => callback([...messages]));
        }
        return;
      }
    }
    throw new Error(`Message ${id} not found`);
  }

  async listMessages(sessionId: string, options?: { limit?: number; order?: 'asc' | 'desc' }): Promise<Message[]> {
    const messages = this.messages.get(sessionId) || [];
    const sorted = [...messages].sort((a, b) => 
      options?.order === 'asc' ? a._creationTime - b._creationTime : b._creationTime - a._creationTime
    );
    
    if (options?.limit) {
      return sorted.slice(0, options.limit);
    }
    return sorted;
  }

  // ==========================================================================
  // Subscription Operations
  // ==========================================================================

  subscribeToSession(sessionId: string, callback: (session: Session | null) => void): Subscription {
    if (!this.sessionSubscriptions.has(sessionId)) {
      this.sessionSubscriptions.set(sessionId, new Set());
    }
    
    const subscriptions = this.sessionSubscriptions.get(sessionId)!;
    subscriptions.add(callback);
    
    // Send initial data
    const session = this.sessions.get(sessionId);
    callback(session || null);
    
    return {
      unsubscribe: () => {
        subscriptions.delete(callback);
        if (subscriptions.size === 0) {
          this.sessionSubscriptions.delete(sessionId);
        }
      },
      isActive: true
    };
  }

  subscribeToMessages(sessionId: string, callback: (messages: Message[]) => void): Subscription {
    if (!this.messageSubscriptions.has(sessionId)) {
      this.messageSubscriptions.set(sessionId, new Set());
    }
    
    const subscriptions = this.messageSubscriptions.get(sessionId)!;
    subscriptions.add(callback);
    
    // Send initial data
    const messages = this.messages.get(sessionId) || [];
    callback([...messages]);
    
    return {
      unsubscribe: () => {
        subscriptions.delete(callback);
        if (subscriptions.size === 0) {
          this.messageSubscriptions.delete(sessionId);
        }
      },
      isActive: true
    };
  }

  subscribeToEvents(callback: (event: DatabaseEvent) => void): Subscription {
    const wrapper = (event: DatabaseEvent) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    };
    
    // Subscribe to all event types
    this.eventListeners.forEach((listeners, type) => {
      listeners.add(wrapper);
    });
    
    return {
      unsubscribe: () => {
        this.eventListeners.forEach((listeners) => {
          listeners.delete(wrapper);
        });
      },
      isActive: true
    };
  }

  onMessageAdded(callback: (message: Message) => void): Subscription {
    this.messageAddedListeners.add(callback);
    return {
      unsubscribe: () => this.messageAddedListeners.delete(callback),
      isActive: true
    };
  }

  onMessageUpdated(callback: (message: Message) => void): Subscription {
    this.messageUpdatedListeners.add(callback);
    return {
      unsubscribe: () => this.messageUpdatedListeners.delete(callback),
      isActive: true
    };
  }

  onSessionUpdated(callback: (session: Session) => void): Subscription {
    this.sessionUpdatedListeners.add(callback);
    return {
      unsubscribe: () => this.sessionUpdatedListeners.delete(callback),
      isActive: true
    };
  }

  onEvent(type: DatabaseEventType, callback: (event: DatabaseEvent) => void): Subscription {
    const listeners = this.eventListeners.get(type);
    if (!listeners) {
      throw new Error(`Unknown event type: ${type}`);
    }
    
    listeners.add(callback);
    return {
      unsubscribe: () => listeners.delete(callback),
      isActive: true
    };
  }

  // ==========================================================================
  // Event Emitter
  // ==========================================================================

  emitEvent(type: DatabaseEventType, data?: any): void {
    const event: DatabaseEvent = {
      type,
      timestamp: new Date().toISOString(),
      data
    };
    
    const listeners = this.eventListeners.get(type);
    listeners?.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`Error in ${type} event callback:`, error);
        this.emitEvent('error', { error, event });
      }
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private generateId(): string {
    return `soryos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanupSession(sessionId: string): Promise<void> {
    // Remove all subscriptions for this session
    this.sessionSubscriptions.delete(sessionId);
    this.messageSubscriptions.delete(sessionId);
    this.messages.delete(sessionId);
    this.sessions.delete(sessionId);
  }

  async cleanupAll(): Promise<void> {
    this.sessions.clear();
    this.messages.clear();
    this.sessionSubscriptions.clear();
    this.messageSubscriptions.clear();
    this.messageAddedListeners.clear();
    this.messageUpdatedListeners.clear();
    this.sessionUpdatedListeners.clear();
    this.eventListeners.forEach(listeners => listeners.clear());
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let databaseInstance: RealTimeDatabase | null = null;

export function getRealTimeDatabase(): RealTimeDatabase {
  if (!databaseInstance) {
    databaseInstance = new InMemoryRealTimeDatabase();
  }
  return databaseInstance;
}

export function createRealTimeDatabase(): RealTimeDatabase {
  return new InMemoryRealTimeDatabase();
}

// ============================================================================
// Exports
// ============================================================================

export { RealTimeDatabase, InMemoryRealTimeDatabase };
