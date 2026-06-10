const QUEUE_KEY = 'flight_log_pending_queue';

export interface PendingInsert {
  type: 'insert';
  localId: string;
  data: Record<string, any>;
  createdAt: string;
  retryCount: number;
}

export interface PendingUpdate {
  type: 'update';
  logId: string;
  data: Record<string, any>;
  createdAt: string;
  retryCount: number;
}

export interface PendingDelete {
  type: 'delete';
  remoteId: string;
  createdAt: string;
  retryCount: number;
}

export type PendingOp = PendingInsert | PendingUpdate | PendingDelete;

export function getQueue(): PendingOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToQueue(op: PendingOp) {
  try {
    const queue = getQueue();
    queue.push(op);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OFFLINE_QUEUE] Error adding to queue:', e);
  }
}

export function removeFromQueue(opId: string) {
  try {
    const queue = getQueue().filter(op => {
      const id = op.type === 'insert' ? op.localId : op.type === 'update' ? op.logId : op.remoteId;
      return id !== opId;
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OFFLINE_QUEUE] Error removing from queue:', e);
  }
}

export function hasPendingOps(): boolean {
  return getQueue().length > 0;
}

export function pendingCount(): number {
  return getQueue().length;
}
