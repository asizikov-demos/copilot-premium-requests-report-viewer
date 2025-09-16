import { useState, useCallback } from 'react';

/**
 * Manages selection & open state for a user consumption modal.
 * Returns helpers to open with a specific user, close, and query current selection.
 */
export function useUserConsumptionModal() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const open = useCallback((user: string) => setSelectedUser(user), []);
  const close = useCallback(() => setSelectedUser(null), []);
  const isOpen = selectedUser !== null;

  return { selectedUser, isOpen, open, close } as const;
}
