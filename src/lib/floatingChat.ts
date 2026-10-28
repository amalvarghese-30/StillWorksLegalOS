import { useSyncExternalStore } from "react";

export interface FloatingChatState {
  isOpen: boolean;
  isExpanded: boolean;
  activeGroupId: string | null;
}

let state: FloatingChatState = {
  isOpen: false,
  isExpanded: false,
  activeGroupId: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const floatingChatStore = {
  getState(): FloatingChatState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  open(groupId?: string | null) {
    state = {
      ...state,
      isOpen: true,
      ...(groupId !== undefined ? { activeGroupId: groupId } : {}),
    };
    emitChange();
  },

  close() {
    state = { ...state, isOpen: false };
    emitChange();
  },

  toggle() {
    state = { ...state, isOpen: !state.isOpen };
    emitChange();
  },

  setExpanded(expanded: boolean) {
    state = { ...state, isExpanded: expanded };
    emitChange();
  },

  setActiveGroup(groupId: string | null) {
    state = { ...state, activeGroupId: groupId };
    emitChange();
  },
};

export function useFloatingChat() {
  const currentState = useSyncExternalStore(
    floatingChatStore.subscribe,
    floatingChatStore.getState,
    floatingChatStore.getState,
  );

  return {
    isOpen: currentState.isOpen,
    isExpanded: currentState.isExpanded,
    activeGroupId: currentState.activeGroupId,
    open: floatingChatStore.open,
    close: floatingChatStore.close,
    toggle: floatingChatStore.toggle,
    setExpanded: floatingChatStore.setExpanded,
    setActiveGroup: floatingChatStore.setActiveGroup,
  };
}
