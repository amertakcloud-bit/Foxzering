import Logo from "./Logo";
import "../styles/loader.css";

// Loading screen with the Foxzering logo (used while a page or the footer is being downloaded).
// inline = fits inside a page; default fills the content area.
export default function LogoLoader({ label = "", inline = false }) {
  return (
    <div className={"lg-loader" + (inline ? " is-inline" : "")} role="status" aria-live="polite" aria-label={label || "Loading"}>
      <div className="lg-mark">
        <span className="lg-ring" aria-hidden="true" />
        <span className="lg-logo"><Logo /></span>
      </div>
      {label ? <p className="lg-label">{label}</p> : null}
    </div>
  );
}
