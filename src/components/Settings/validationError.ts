import { AnnotationApiError } from "../../types/annotation.types";

export interface ValidationDetails {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
}

function isValidationDetails(value: unknown): value is ValidationDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ValidationDetails).formErrors) &&
    typeof (value as ValidationDetails).fieldErrors === "object" &&
    (value as ValidationDetails).fieldErrors !== null
  );
}

export function validationDetailsFrom(error: unknown): ValidationDetails | null {
  if (!(error instanceof AnnotationApiError) || error.status !== 400 || !error.body) {
    return null;
  }
  try {
    const parsed = JSON.parse(error.body) as { details?: unknown };
    return isValidationDetails(parsed.details) ? parsed.details : null;
  } catch {
    return null;
  }
}

export function fieldError(details: ValidationDetails | null, field: string): string | undefined {
  return details?.fieldErrors[field]?.[0];
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
