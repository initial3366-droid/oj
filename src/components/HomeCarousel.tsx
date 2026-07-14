/**
 * 首页Carousel组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Button } from '@douyinfe/semi-ui';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';
import { useEffect, useMemo, useState } from 'react';
import { useOjData } from '../data/OjDataProvider';

/**
 * 渲染首页Carousel组件，并协调其数据加载、状态和交互。
 */
export function HomeCarousel() {
  const { state } = useOjData();
  const slides = state.carouselSlides;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= slides.length) {
      setIndex(0);
    }
  }, [index, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  /**
   * 封装有效Slide相关逻辑。对原始数据进行派生或聚合。
   */
  const activeSlide = useMemo(() => slides[index] ?? slides[0], [index, slides]);

  if (!activeSlide) {
    return null;
  }

  /**
   * 封装next相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const next = () => setIndex((current) => (current + 1) % slides.length);
  /**
   * 封装previous相关逻辑。会更新 React 状态并触发重新渲染。
   */
  const previous = () =>
    setIndex((current) => (current - 1 + slides.length) % slides.length);
  const hasMultipleSlides = slides.length > 1;

  return (
    <div
      style={{
        position: 'relative',
        height: 580,
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid var(--semi-color-border)',
      }}
    >
      <img
        alt={activeSlide.title}
        src={activeSlide.imageUrl}
        style={{
          height: '100%',
          width: '100%',
          borderRadius: 8,
          objectFit: 'cover',
        }}
      />
      {hasMultipleSlides ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            minHeight: 32,
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                aria-label={`切换到轮播 ${slideIndex + 1}`}
                style={{
                  height: 6,
                  borderRadius: 9999,
                  transition: 'all 0.2s',
                  width: slideIndex === index ? 32 : 12,
                  backgroundColor: slideIndex === index ? 'white' : 'rgba(255,255,255,0.45)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setIndex(slideIndex)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              aria-label="上一张轮播图"
              icon={<IconChevronLeft />}
              size="small"
              theme="borderless"
              style={{
                backgroundColor: 'rgba(0,0,0,0.32)',
                color: 'white',
              }}
              onClick={previous}
            />
            <Button
              aria-label="下一张轮播图"
              icon={<IconChevronRight />}
              size="small"
              theme="borderless"
              style={{
                backgroundColor: 'rgba(0,0,0,0.32)',
                color: 'white',
              }}
              onClick={next}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
