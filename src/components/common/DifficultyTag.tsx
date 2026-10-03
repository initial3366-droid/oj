/**
 * DifficultyTag组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { AnimatedBadge } from '../motion/animated-badge';

/**
 * Difficulty类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type Difficulty = '简单' | '中等' | '困难' | 'Easy' | 'Medium' | 'Hard' | string;

/**
 * DifficultyTagProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface DifficultyTagProps {
  difficulty: Difficulty;
  size?: 'small' | 'default' | 'large' | 'sm' | 'md' | 'lg';
}

/**
 * 难度标签组件
 * 简单-绿色、中等-橙色、困难-红色
 */
export function DifficultyTag({ difficulty, size = 'sm' }: DifficultyTagProps) {
  /**
   * 读取Difficulty配置并返回给调用方。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const getDifficultyConfig = (diff: string) => {
    const normalized = diff.toLowerCase();

    if (normalized.includes('简单') || normalized === 'easy') {
      return {
        status: 'success' as const,
        text: difficulty,
      };
    }

    if (normalized.includes('中等') || normalized === 'medium') {
      return {
        status: 'warning' as const,
        text: difficulty,
      };
    }

    if (normalized.includes('困难') || normalized === 'hard') {
      return {
        status: 'danger' as const,
        text: difficulty,
      };
    }

    return {
      status: 'neutral' as const,
      text: difficulty,
    };
  };

  const config = getDifficultyConfig(difficulty);

  return (
    <AnimatedBadge status={config.status} size={size === 'small' || size === 'sm' ? 'sm' : 'md'} showIcon={false}>
      {config.text}
    </AnimatedBadge>
  );
}
