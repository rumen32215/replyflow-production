"use client";

// Adapted from shadcn/ui's toast hook (MIT) — a minimal reducer-based
// store so any component can call `toast()` without prop drilling.
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

interface State {
  toasts: ToasterToast[];
}

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    case "DISMISS_TOAST": {
      const { toastId } = action;
      if (toastId) {
        setTimeout(() => dispatch({ type: "REMOVE_TOAST", toastId }), TOAST_REMOVE_DELAY);
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) return { ...state, toasts: [] };
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) };
  }
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();
  const update = (props: ToasterToast) => dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => !open && dismiss(),
    },
  });

  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }) };
}

export { useToast, toast };
