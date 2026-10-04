import type { ErdEntity, ErdField } from "../../types/dataModel.types";

export function primaryKeyFields(entity: ErdEntity): ErdField[] {
  return entity.fields.filter((field) => field.primaryKey);
}

export function referenceKey(entity: ErdEntity): ErdField[] {
  const keys = primaryKeyFields(entity);
  if (keys.length > 0) return keys;
  const id = entity.fields.find((field) => field.name.toLowerCase() === "id");
  if (id) return [id];
  const unique = entity.fields.find((field) => field.unique);
  return unique ? [unique] : [];
}

export function singularName(name: string): string {
  const lower = name.toLowerCase();
  if (/ies$/.test(lower)) return `${name.slice(0, -3)}y`;
  if (/(s|x|z|ch|sh)es$/.test(lower)) return name.slice(0, -2);
  if (/s$/.test(lower) && !/ss$/.test(lower)) return name.slice(0, -1);
  return name;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function referenceColumnNames(parent: ErdEntity, key: ErdField): string[] {
  const bases = [...new Set([parent.name, singularName(parent.name)])];
  const derived = bases.flatMap((base) => [
    `${base}_${key.name}`,
    `${base}${capitalize(key.name)}`,
  ]);
  return key.name.toLowerCase() === "id" ? derived : [key.name, ...derived];
}

export function findReferenceColumn(
  child: ErdEntity,
  parent: ErdEntity,
  key: ErdField,
): ErdField | undefined {
  const names = new Set(referenceColumnNames(parent, key).map((name) => name.toLowerCase()));
  return child.fields.find(
    (field) =>
      field.id !== key.id &&
      names.has(field.name.toLowerCase()) &&
      !(child.id === parent.id && field.primaryKey),
  );
}

export function holdsReference(child: ErdEntity, parent: ErdEntity): boolean {
  if (child.id === parent.id) return false;
  const keys = referenceKey(parent);
  return keys.length > 0 && keys.every((key) => findReferenceColumn(child, parent, key));
}
