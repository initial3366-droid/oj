/**
 * filterReact19RefWarning工具模块。提供无页面依赖的通用处理能力。
 */
const FILTERED_WARNINGS = [
  'Accessing element.ref was removed in React 19',
  'Each child in a list should have a unique "key" prop',
];

/**
 * 封装filterReact19RefWarning相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
export function filterReact19RefWarning() {
  if (typeof console === 'undefined') {
    return;
  }
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && FILTERED_WARNINGS.some((w) => first.includes(w))) {
      return;
    }
    originalError(...args);
  };
}
