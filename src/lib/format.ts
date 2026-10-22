/** Display calendar dates consistently, preserving the browser's local timezone. */
export function formatDisplayDate(value?: string | number | Date | null): string {
  if (value == null || value === '') return '-';
  const date = value instanceof Date ? value : new Date(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );
  if (!Number.isFinite(date.getTime())) return '-';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Display timestamps as local date and time with second precision. */
export function formatDisplayDateTime(value?: string | number | Date | null): string {
  if (value == null || value === '') return '-';
  const date = value instanceof Date ? value : new Date(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );
  if (!Number.isFinite(date.getTime())) return '-';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export const formatDateTime = formatDisplayDate;
export const formatLocalDateTime = formatDisplayDate;

/**
 * 封装difficultyColor相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function difficultyColor(difficulty: string) {
  switch (difficulty) {
    case "入门":
    case "简单":
      return "green";
    case "中等":
      return "orange";
    case "困难":
      return "red";
    default:
      return "grey";
  }
}
