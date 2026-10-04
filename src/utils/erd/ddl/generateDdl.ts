import type { ErdDocumentJSON } from "../../../types/dataModel.types";
import { buildDdlModel, type DdlDialect } from "./ddlCommon";
import { renderMysqlDdl } from "./mysqlDdl";
import { renderPostgresDdl } from "./postgresDdl";
import { renderSqliteDdl } from "./sqliteDdl";

export type { DdlDialect } from "./ddlCommon";

export const DDL_DIALECTS: readonly DdlDialect[] = ["postgres", "mysql", "sqlite"];

export const DDL_DIALECT_LABELS: Record<DdlDialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

export function generateDdl(document: ErdDocumentJSON, dialect: DdlDialect): string {
  if (dialect === "mysql") return renderMysqlDdl(document);
  if (dialect === "sqlite") return renderSqliteDdl(document);
  return renderPostgresDdl(document);
}

export function ddlWarnings(document: ErdDocumentJSON): string[] {
  return buildDdlModel(document).skipped;
}
