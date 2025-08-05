import { useRef, useState, useEffect } from 'react';
import { FaPlay, FaPause, FaRedo } from 'react-icons/fa';

const formatTime = (seconds) => {
    const secs = Math.floor(seconds);
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining.toString().padStart(2, '0')}`;
};

const VideoPlayer = ({ videoUrl, isSent, isTemp }) => {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [formattedUrl, setFormattedUrl] = useState('');
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

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
            console.error('Video Error:', video.error);
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
            document.querySelectorAll('video').forEach((v) => {
                if (v !== video && !v.paused) {
                    v.pause();
                }
            });
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

        try {
            video.src = formattedUrl;
            video.load();
        } catch (err) {
            console.error('Video source error:', err);
            handleError();
        }

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

    const togglePlayPause = () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(err => {
                console.error('Playback failed:', err);
                setHasError(true);
                setIsPlaying(false);
            });
        }
    };

    const handleRetry = () => {
        setHasError(false);
        setRetryCount(0);
    };

    return (
        <div className={`relative rounded-lg overflow-hidden ${isSent ? 'ml-auto' : 'mr-auto'}`}>
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
                        className="w-full max-w-md h-[500px]"
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

                    <div className={`text-[12px] ${isSent ? "text-black/70" : "text-white/70"} text-right -mb-4`}>
                        {new Date(currentTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </div>

                </>
            )}
        </div>
    );
};

export default VideoPlayer;