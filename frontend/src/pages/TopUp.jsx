
import { useLanguage } from "../context/LanguageContext";

function TopUp() {
    const { t } = useLanguage();
    return (
        <div className="page">
            <h1 className="page-heading">{t('Game TopUp')}</h1>
            <p className="page-subtitle">Fast game topup, secure, accept KHQR.</p>

            <h2>Comming Soon!</h2>
        </div>
    );
}

export default TopUp