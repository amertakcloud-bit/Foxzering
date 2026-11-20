// import { useAudio } from "./AudioContext";

export default function AudioPlayer() {

    const { isPlaying, togglePlay } = useAudio();
  return (
    <button onClick={togglePlay} id="player" className="music-player">
      <div className="music-icon">
        <i className={isPlaying ? "ri-pause-fill" : "ri-music-2-line"}></i>
      </div>
      <span>{isPlaying ? "Pause" : "Music"}</span>
    </button>
  );
}
