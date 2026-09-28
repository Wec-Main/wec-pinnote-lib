import { useContext, useEffect } from "react";
import { AnnotationViewContext } from "../context/AnnotationViewContext";

export function useAnnotationView(name: string): void {
  const context = useContext(AnnotationViewContext);

  useEffect(() => {
    if (!context) {
      return;
    }
    return context.registerView(name);
  }, [context, name]);
}
