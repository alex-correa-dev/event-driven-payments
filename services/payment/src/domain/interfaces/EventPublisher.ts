export interface EventPublisher {
  publish(eventName: string, data: Record<string, unknown>): Promise<void>;
}
