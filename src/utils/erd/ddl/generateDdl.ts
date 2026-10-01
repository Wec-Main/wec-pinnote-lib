import type { ErdDocumentJSON } from "../../../types/dataModel.types";
import type { DdlDialect } from "./ddlCommon";
import { renderMysqlDdl } from "./mysqlDdl";
import { renderPostgresDdl } from "./postgresDdl";

export type { DdlDialect } from "./ddlCommon";

export const DDL_DIALECTS: readonly DdlDialect[] = ["postgres", "mysql"];

export function generateDdl(document: ErdDocumentJSON, dialect: DdlDialect): string {
  return dialect === "mysql" ? renderMysqlDdl(document) : renderPostgresDdl(document);
}
