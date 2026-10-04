import type { ErdDocumentJSON } from "../../../types/dataModel.types";
import { generateDrizzleSchema } from "./drizzle";
import { generateOpenApiSchemas } from "./openapi";
import { generatePrismaSchema } from "./prisma";
import { generateTypeScript } from "./typescript";

export type CodeTarget = "typescript" | "prisma" | "drizzle" | "openapi";

export const CODE_TARGETS: readonly CodeTarget[] = ["typescript", "prisma", "drizzle", "openapi"];

export const CODE_TARGET_LABELS: Record<CodeTarget, string> = {
  typescript: "TypeScript + Zod",
  prisma: "Prisma",
  drizzle: "Drizzle",
  openapi: "OpenAPI",
};

export const CODE_FILE_SUFFIX: Record<CodeTarget, string> = {
  typescript: ".ts",
  prisma: ".prisma",
  drizzle: ".schema.ts",
  openapi: ".json",
};

export const CODE_MIME_TYPE: Record<CodeTarget, string> = {
  typescript: "text/plain",
  prisma: "text/plain",
  drizzle: "text/plain",
  openapi: "application/json",
};

export function generateCode(target: CodeTarget, document: ErdDocumentJSON): string {
  if (target === "prisma") return generatePrismaSchema(document);
  if (target === "drizzle") return generateDrizzleSchema(document);
  if (target === "openapi") return generateOpenApiSchemas(document);
  return generateTypeScript(document);
}
