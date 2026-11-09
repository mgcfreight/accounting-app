import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

// Lets a detail page add what it is showing to the header's title — e.g. an
// invoice's number, "Shipper Invoice #sin_AST011_11" — once the page has loaded it,
// without the header knowing about the page.
const DetailContext = createContext<string | null>(null);
const SetDetailContext = createContext<((detail: string | null) => void) | null>(
  null
);

// Two contexts: a page that sets the detail doesn't re-render when it changes.
export function HeaderDetailProvider({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<string | null>(null);
  return (
    <SetDetailContext.Provider value={setDetail}>
      <DetailContext.Provider value={detail}>{children}</DetailContext.Provider>
    </SetDetailContext.Provider>
  );
}

// Called by a page: show `detail` after the route's title until the page
// leaves. Null shows the title alone.
export function useHeaderDetail(detail: string | null) {
  const setDetail = useContext(SetDetailContext);

  useEffect(() => {
    setDetail?.(detail);
    return () => setDetail?.(null);
  }, [detail, setDetail]);
}

// Called by the header.
export function useHeaderDetailValue() {
  return useContext(DetailContext);
}
