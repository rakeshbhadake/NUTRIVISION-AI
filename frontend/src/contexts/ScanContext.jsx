import { createContext, useContext, useEffect, useState } from "react";
const ScanContext = createContext(null);
export function ScanProvider({ children }) {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(null),
    [analysis, setAnalysis] = useState(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <ScanContext.Provider
      value={{ file, setFile, preview, analysis, setAnalysis }}
    >
      {children}
    </ScanContext.Provider>
  );
}
export const useScan = () => useContext(ScanContext);
