import { createContext, useContext, useState, useRef } from "react";
import AudioMedia from "../assets/music/Kiminito.m4a";

const AudioContext = createContext();
export default function AudioProvider({children}) {
  const [isPlaying, setIsPlaying] = useState();
  const audioRef = useRef(new Audio(AudioMedia));

  audioRef.current.onEnded = () => setIsPlaying(false);

  function togglePlay() {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }

    setIsPlaying(!isPlaying);
  }
  return (
    <AudioContext.Provider value={{ isPlaying, togglePlay }}>
        {children}
    </AudioContext.Provider>
  );
}

export default function useAudio() {
    const context = useContext(AudioContext);

    if(!context) {
      throw new error("useAudio is not used in AudioProvider!")
    }

    return context;
}