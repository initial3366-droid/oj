/**
 * format工具模块。提供无页面依赖的通用处理能力。
 */
export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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
