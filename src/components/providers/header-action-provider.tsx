import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

// Lets the header's "create new" button (routes.config.ts) open something on
// the current page — e.g. the Record Payment modal — without the header
// knowing about the page.
type Registry = Map<string, () => void>;

const HeaderActionContext = createContext<{
  registry: RefObject<Registry>;
} | null>(null);

// The value never changes: DashboardLayout re-renders on every sidebar hover,
// and a new object here would re-render every page that registers an action.
export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const registry = useRef<Registry>(new Map());
  const value = useMemo(() => ({ registry }), []);
  return (
    <HeaderActionContext.Provider value={value}>
      {children}
    </HeaderActionContext.Provider>
  );
}

// Called by a page: run `handler` when the header button for `action` is
// pressed.
export function useHeaderAction(action: string, handler: () => void) {
  const context = useContext(HeaderActionContext);
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const registry = context?.registry.current;
    if (!registry) return;
    registry.set(action, () => latest.current());
    return () => {
      registry.delete(action);
    };
  }, [action, context]);
}

// Called by the header.
export function useTriggerHeaderAction() {
  const context = useContext(HeaderActionContext);
  return (action: string) => context?.registry.current.get(action)?.();
}
