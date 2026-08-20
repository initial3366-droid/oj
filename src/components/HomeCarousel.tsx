/**
 * 首页Carousel组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Carousel } from 'antd';
import { useMemo } from 'react';
import { useOjData } from '../data/OjDataProvider';

/**
 * 渲染首页Carousel组件，并协调其数据加载、状态和交互。
 */
export function HomeCarousel() {
  const { state } = useOjData();
  const slides = state.carouselSlides;

  /**
   * 封装有效Slide相关逻辑。对原始数据进行派生或聚合。
   */
  const hasMultipleSlides = useMemo(() => slides.length > 1, [slides]);

  if (slides.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 580,
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
      }}
    >
      <Carousel
        autoplay={hasMultipleSlides}
        autoplaySpeed={5200}
        arrows={hasMultipleSlides}
        dots={hasMultipleSlides}
        infinite
        speed={600}
      >
        {slides.map((slide) => (
          <div key={slide.id}>
            <img
              alt={slide.title}
              src={slide.imageUrl}
              style={{
                height: 580,
                width: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        ))}
      </Carousel>
    </div>
  );
}
