import { createContext } from "react";

export interface AnnotationViewContextValue {
  registerView: (name: string) => () => void;
}

export const AnnotationViewContext = createContext<AnnotationViewContextValue | null>(null);
