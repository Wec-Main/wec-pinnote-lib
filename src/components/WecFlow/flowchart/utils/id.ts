let counter = 0;

/** Short, collision-resistant id such as "process_k3j9x2a1". */
export function createId(prefix = 'id'): string {
  counter = (counter + 1) % 1296;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${random}${counter.toString(36).padStart(2, '0')}`;
}
