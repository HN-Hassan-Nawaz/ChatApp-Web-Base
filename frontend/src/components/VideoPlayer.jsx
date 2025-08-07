import { useRef, useState, useEffect } from 'react';
import { FaPlay, FaPause, FaRedo } from 'react-icons/fa';
import { RiFullscreenFill } from "react-icons/ri";
import { RxCross2 } from 'react-icons/rx';

const formatTime = (seconds) => {
    const secs = Math.floor(seconds);
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining.toString().padStart(2, '0')}`;
};

const VideoPlayer = ({ videoUrl, isSent, isTemp, timestamp }) => {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [formattedUrl, setFormattedUrl] = useState('');
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const expandedRef = useRef(null);
    const [isExpandedPlaying, setIsExpandedPlaying] = useState(false);
    const [expandedTime, setExpandedTime] = useState(0);

    useEffect(() => {
        if (!videoUrl) return;
        let formatted = videoUrl;
        if (videoUrl.startsWith('data:video')) {
            const parts = videoUrl.split(';base64,');
            if (parts.length === 2) {
                const [header, data] = parts;
                formatted = `${header};base64,${data}`;
            }
        }
        setFormattedUrl(formatted);
        setHasError(false);
        setRetryCount(0);
    }, [videoUrl]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !formattedUrl) return;

        let retryTimer;

        const handleError = () => {
            setHasError(true);
            if (retryCount < 2) {
                retryTimer = setTimeout(() => {
                    video.src = `${formattedUrl}?retry=${retryCount}`;
                    setRetryCount(c => c + 1);
                }, 1000 * (retryCount + 1));
            }
        };

        const handleCanPlay = () => {
            setHasError(false);
            setDuration(video.duration || 0);
        };

        const handlePlay = () => {
            setIsPlaying(true);
        };

        const handlePause = () => {
            setIsPlaying(false);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(duration);
        };

        video.addEventListener('error', handleError);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        video.src = formattedUrl;
        video.load();

        return () => {
            clearTimeout(retryTimer);
            video.removeEventListener('error', handleError);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
            if (isTemp && formattedUrl.startsWith('blob:')) {
                URL.revokeObjectURL(formattedUrl);
            }
        };
    }, [formattedUrl, isTemp, retryCount]);

    // Small Video Controls
    const togglePlayPause = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(() => {
                setHasError(true);
                setIsPlaying(false);
            });
        }
    };

    // Expanded Video Controls
    const toggleExpandedPlay = () => {
        const video = expandedRef.current;
        if (!video) return;

        if (isExpandedPlaying) {
            video.pause();
        } else {
            video.play().catch(() => setIsExpandedPlaying(false));
        }
    };

    // Retry
    const handleRetry = () => {
        setHasError(false);
        setRetryCount(0);
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const showProgressBar = isHovered || isPlaying;

    return (
        <>
            {/* Small Video */}
            <div
                className={`relative rounded-lg overflow-hidden ${isSent ? 'ml-auto' : 'mr-auto'}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {hasError ? (
                    <div className="bg-red-50 p-4 text-center">
                        <p className="text-red-600 mb-2">Video playback error</p>
                        <button
                            onClick={handleRetry}
                            className="flex items-center justify-center gap-2 px-3 py-1 bg-blue-500 text-white rounded"
                        >
                            <FaRedo /> Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            className="w-full max-w-md h-[550px]"
                            controls={false}
                            playsInline
                            preload="metadata"
                            onClick={togglePlayPause}
                        />

                        <button
                            onClick={togglePlayPause}
                            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                                w-12 h-12 rounded-full flex items-center justify-center
                                ${isPlaying ? 'bg-white/30' : 'bg-white/80'} ${isSent ? 'text-green-600' : 'text-gray-600'}`}
                        >
                            {isPlaying ? <FaPause /> : <FaPlay />}
                        </button>

                        {showProgressBar && (
                            <div className="absolute bottom-12 left-4 right-4 w-auto h-1 bg-gray-300/40 rounded-full">
                                <div
                                    className="h-full bg-green-500 mb-3 transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                                <div className={`text-[12px] float-left ${isSent ? "text-white" : "text-white/70"}`}>
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </div>
                                <div className='float-right ml-2 cursor-pointer' onClick={() => setIsExpanded(true)}>
                                    <RiFullscreenFill />
                                </div>
                                <div className={`text-[12px] float-right ${isSent ? "text-white" : "text-white/50"}`}>
                                    {timestamp ? new Date(timestamp).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                    }) : "Unknown time"}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Overlay Expanded Video */}
            {isExpanded && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
                    <div className="relative w-full max-w-4xl">
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="absolute top-4 right-4 text-white text-2xl z-10"
                        >
                            <RxCross2 />
                        </button>

                        <video
                            ref={expandedRef}
                            className="w-full h-[600px] rounded-md"
                            controls={false}
                            autoPlay
                            playsInline
                            preload="metadata"
                            src={formattedUrl}
                            onClick={toggleExpandedPlay}
                            onPlay={() => setIsExpandedPlaying(true)}
                            onPause={() => setIsExpandedPlaying(false)}
                            onTimeUpdate={(e) => setExpandedTime(e.target.currentTime)}
                        />

                        <button
                            onClick={toggleExpandedPlay}
                            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                                w-14 h-14 rounded-full flex items-center justify-center
                                ${isExpandedPlaying ? 'bg-white/30' : 'bg-white/80'} text-gray-700`}
                        >
                            {isExpandedPlaying ? <FaPause /> : <FaPlay />}
                        </button>

                        <div className="absolute bottom-12 left-8 right-8">
                            <div className="h-1 bg-gray-300/50 rounded-full">
                                <div
                                    className="h-full bg-green-500 transition-all duration-300"
                                    style={{ width: `${(expandedTime / duration) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1 text-sm text-white">
                                <span>{formatTime(expandedTime)} / {formatTime(duration)}</span>
                                <span>
                                    {timestamp ? new Date(timestamp).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                    }) : "Unknown time"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default VideoPlayer;