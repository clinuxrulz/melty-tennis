type EventListener = (data: any) => void;

class GameEvents {
  private listeners: Map<string, EventListener[]> = new Map();
  
  on(event: string, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  off(event: string, listener: EventListener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(l => l(data));
    }
  }
}

export const gameEvents = new GameEvents();