/**
 * @soryos/bus
 * Central event bus for real agent runtime lifecycles.
 */

import { AgentEventType, AgentEventPayload } from "@soryos/schema";

export type EventListener = (event: AgentEventPayload) => void;

export class EventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private wildcardListeners: Set<EventListener> = new Set();

  public on(eventType: AgentEventType | "*", listener: EventListener): () => void {
    if (eventType === "*") {
      this.wildcardListeners.add(listener);
      return () => this.wildcardListeners.delete(listener);
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  public emit(sessionId: string, type: AgentEventType, data: Record<string, unknown> = {}): void {
    const payload: AgentEventPayload = {
      sessionId,
      timestamp: new Date().toISOString(),
      type,
      data,
    };

    const specific = this.listeners.get(type);
    if (specific) {
      for (const listener of specific) {
        try {
          listener(payload);
        } catch (err) {
          console.error(`[EventBus] Error in listener for ${type}:`, err);
        }
      }
    }

    for (const listener of this.wildcardListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[EventBus] Error in wildcard listener for ${type}:`, err);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }
}

export const globalEventBus = new EventBus();
