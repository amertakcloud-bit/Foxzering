import { useLanguage } from "../context/LanguageContext";
import { Link } from "react-router-dom";
import ToolCards from "../components/ToolCards";
import ServiceCards from "../components/ServiceCards";
import toolCards from "../data/toolCards";
import serviceCards from "../data/serviceCards";
import banner from "../assets/favicon/banner.svg";
import BannerSlider from "../components/BannerSlider";

function GetStart() {
  const { t } = useLanguage();

  return (
    <div className="page" data-aos="fade-in">
      <h1
        className="page-heading reflect"
        data-aos="fade-in"
        data-aos-delay="100"
      >
        {t("getStartTitle")}
      </h1>
      <p
        className="page-subtitle reflect"
        data-aos="fade-in"
        data-aos-delay="200"
      >
        {t("getStartSub")}
      </p>

      {/* Banner */}

      <div data-aos="fade-up" data-aos-delay="250">
        <BannerSlider />
      </div>
      {/* ... */}

      {/* Tools */}
      <span data-aos="fade-in" data-aos-delay="150">
        <i className="ri-settings-6-line"></i>
        <p className="reflect">{t("Tools")}</p>
      </span>
      <div className="tools-container" data-aos="fade-in" data-aos-delay="250">
        {toolCards.map((t) => (
          <ToolCards
            key={t.name}
            aosDelay={t.aosDelay}
            path={t.path}
            name={t.name}
            tag={t.tag}
            icon={t.icon}
            describe={t.describe}
          />
        ))}
      </div>
    </div>
  );
}

export default GetStart;
