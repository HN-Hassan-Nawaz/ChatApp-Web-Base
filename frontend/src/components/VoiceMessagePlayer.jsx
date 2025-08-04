import { FaPlay, FaPause } from "react-icons/fa";
import { BsCheckAll } from "react-icons/bs";

const VoiceMessagePlayer = ({ voiceData, duration = 0, senderName, timestamp, isSent }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration);

    const formatTime = (seconds) => {
        const secs = Math.max(0, Math.floor(seconds));
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            if (audio.duration && audio.duration !== Infinity) {
                setAudioDuration(audio.duration);
            }
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [voiceData]);

    const togglePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }

        setIsPlaying(!isPlaying);
    };

    return (
        <div className={`flex items-center p-3 rounded-2xl shadow ${isSent ? 'bg-green-500 text-white ml-auto' : 'bg-white text-black'} w-[100px]`}>
            {!isSent && (
                <div className="w-8 h-8 mr-3 rounded-full bg-gray-700 text-gray-800 flex items-center justify-center font-bold text-sm">
                    {senderName?.charAt(0).toUpperCase()}
                </div>
            )}

            <button onClick={togglePlayPause} className={`mr-3 p-2 rounded-full ${isSent ? 'bg-black text-green-600' : 'bg-green-500 text-white'}`}>
                {isPlaying ? <FaPause /> : <FaPlay />}
            </button>

            <div className="flex-1">
                <div className="w-full h-1 rounded bg-white/40 overflow-hidden mb-1">
                    <div
                        className={`${isSent ? 'bg-white' : 'bg-green-500'} h-full`}
                        style={{ width: `${(currentTime / (audioDuration || 1)) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs">
                    <span className="font-mono">{formatTime(audioDuration)}</span>
                    <span className={`${isSent ? 'text-white/80' : 'text-gray-500'}`}>
                        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isSent && <BsCheckAll className="inline-block ml-1" />}
                    </span>
                </div>
            </div>

            <audio ref={audioRef} src={`data:audio/webm;base64,${voiceData}`} preload="metadata" />
        </div>
    );
};
export default VoiceMessagePlayer;