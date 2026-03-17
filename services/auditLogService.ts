import type { AuditLogEntry } from '../types';

const AUDIT_LOG_STORAGE_KEY = 'reRideAuditLog';

export const getAuditLog = (): AuditLogEntry[] => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
    const logJson = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    return logJson ? JSON.parse(logJson) : [];
  } catch (error) {
    console.error("Failed to parse audit log from localStorage", error);
    return [];
  }
};

export const saveAuditLog = (log: AuditLogEntry[]) => {
  try {
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch (error) {
    console.error("Failed to save audit log to localStorage", error);
  }
};

export const logAction = (actor: string, action: string, target: string, details?: string): AuditLogEntry => {
    const newLogEntry: AuditLogEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        actor,
        action,
        target,
        details,
    };

    const currentLog = getAuditLog();
    // Keep the log to a reasonable size, e.g., 200 entries
    const updatedLog = [newLogEntry, ...currentLog].slice(0, 200);
    saveAuditLog(updatedLog);
    
    return newLogEntry;
};