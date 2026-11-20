import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import banner1 from "../assets/favicon/banner.svg";
import banner2 from "../assets/favicon/banner.svg";
import banner3 from "../assets/favicon/banner.svg";
import banner4 from "../assets/favicon/banner.svg";
import banner5 from "../assets/favicon/banner.svg";

const banners = [banner1, banner2, banner3, banner4, banner5];

export default function BannerSlider() {
  const sliderRef = useRef(null);
  const timerRef = useRef(null);
  const pausedRef = useRef(false);

  const [active, setActive] = useState(0);

  const getVisible = () => (window.innerWidth >= 768 ? 3 : 1);

  const getMaxIndex = () => Math.max(0, banners.length - getVisible());

  const scrollTo = (index) => {
    const slider = sliderRef.current;
    if (!slider) return;

    const item = slider.children[index];
    if (!item) return;

    slider.scrollTo({
      left: item.offsetLeft,
      behavior: "smooth",
    });

    setActive(index);
    resetTimer();
  };

  const next = () => {
    const max = getMaxIndex();
    const nextIndex = active >= max ? 0 : active + 1;
    scrollTo(nextIndex);
  };

  const prev = () => {
    const max = getMaxIndex();
    const prevIndex = active <= 0 ? max : active - 1;
    scrollTo(prevIndex);
  };

  const resetTimer = () => {
    clearTimeout(timerRef.current);

    if (pausedRef.current) return;

    timerRef.current = setTimeout(() => {
      const max = getMaxIndex();
      const nextIndex = active >= max ? 0 : active + 1;

      scrollTo(nextIndex);
    }, 3000);
  };

  useEffect(() => {
    resetTimer();

    return () => clearTimeout(timerRef.current);
  }, [active]);

  const handleScroll = () => {
    const slider = sliderRef.current;
    if (!slider) return;

    const items = [...slider.children];

    let closest = 0;
    let distance = Infinity;

    items.forEach((item, index) => {
      const diff = Math.abs(item.offsetLeft - slider.scrollLeft);

      if (diff < distance) {
        distance = diff;
        closest = index;
      }
    });

    setActive(closest);
  };

  return (
    <section
      className="banner-slider"
      onMouseEnter={() => {
        pausedRef.current = true;
        clearTimeout(timerRef.current);
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
        resetTimer();
      }}
    >
      <div
        className="banner-track"
        ref={sliderRef}
        onScroll={handleScroll}
        onTouchStart={() => {
          clearTimeout(timerRef.current);
        }}
        onTouchEnd={() => resetTimer()}
      >
        {banners.map((banner, index) => (
          <div className="banner-slide" key={index}>
            <div className="banner">
              <img src={banner} alt={`Banner ${index + 1}`} />

              <div className="banner-hover">
                <Link to="/">
                    <i className="ri-home-line"></i>
                </Link>
                <Link to="/dashboard">
                    <i className="ri-dashboard-line"></i>
                </Link>
                <Link to="/tools">
                    <i className="ri-settings-line"></i>
                </Link>
                <Link to="/plans">
                    <i className="ri-stack-line"></i>
                </Link>
                <Link to="/profile">
                    <i className="ri-user-line"></i>
                </Link>
                <Link to="/settings">
                    <i className="ri-settings-4-line"></i>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="slider-controls">
        <span>
          {String(active + 1).padStart(2, "0")} /{" "}
          {String(banners.length).padStart(2, "0")}
        </span>

        <div className="slider-buttons">
          <button onClick={prev}>
            <i className="ri-arrow-left-line"></i>
          </button>

          <button onClick={next}>
            <i className="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    </section>
  );
}
