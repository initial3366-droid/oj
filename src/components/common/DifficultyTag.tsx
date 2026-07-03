import { Tag } from '@douyinfe/semi-ui';

type Difficulty = '简单' | '中等' | '困难' | 'Easy' | 'Medium' | 'Hard' | string;

interface DifficultyTagProps {
  difficulty: Difficulty;
  size?: 'small' | 'default' | 'large' | 'sm' | 'md' | 'lg';
}

/**
 * 难度标签组件
 * 简单-绿色、中等-橙色、困难-红色
 */
export function DifficultyTag({ difficulty, size = 'sm' }: DifficultyTagProps) {
  const tagSize = size === 'sm' ? 'small' : size === 'md' ? 'default' : size === 'lg' ? 'large' : size;
  const getDifficultyConfig = (diff: string) => {
    const normalized = diff.toLowerCase();

    if (normalized.includes('简单') || normalized === 'easy') {
      return {
        color: 'green' as const,
        text: difficulty,
      };
    }

    if (normalized.includes('中等') || normalized === 'medium') {
      return {
        color: 'orange' as const,
        text: difficulty,
      };
    }

    if (normalized.includes('困难') || normalized === 'hard') {
      return {
        color: 'red' as const,
        text: difficulty,
      };
    }

    return {
      color: 'grey' as const,
      text: difficulty,
    };
  };

  const config = getDifficultyConfig(difficulty);

  return (
    <Tag
      color={config.color}
      size={tagSize}
    >
      {config.text}
    </Tag>
  );
}
