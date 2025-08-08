import { useRef, useState, useEffect } from 'react';
import { FaPlay, FaPause, FaRedo } from 'react-icons/fa';
import { RiFullscreenFill } from "react-icons/ri";
import { RxCross2 } from 'react-icons/rx';
import { BsThreeDotsVertical } from 'react-icons/bs';

const formatTime = (seconds) => {
  const secs = Math.floor(seconds);
  const mins = Math.floor(secs / 60);
  const remaining = secs % 60;
  return `${mins}:${remaining.toString().padStart(2, '0')}`;
};

function dataURLToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(';base64,');
  const mime = meta.split(':')[1] || 'application/octet-stream';
  const binStr = atob(base64);
  const len = binStr.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = binStr.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

const VideoPlayer = ({ videoUrl, isSent, isTemp, timestamp, delivered, seen, fileName = 'video.mp4' }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [formattedUrl, setFormattedUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 3-dot menu state
  const [menuOpen, setMenuOpen] = useState(false);

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

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
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
  }, [formattedUrl, isTemp, retryCount, duration]);

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

  const toggleExpandedPlay = () => {
    const video = expandedRef.current;
    if (!video) return;
    if (isExpandedPlaying) {
      video.pause();
    } else {
      video.play().catch(() => setIsExpandedPlaying(false));
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setRetryCount(0);
  };

  const handleDownload = async () => {
    try {
      let blob;
      if (formattedUrl.startsWith('data:')) {
        blob = dataURLToBlob(formattedUrl);
      } else {
        const res = await fetch(formattedUrl);
        blob = await res.blob();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'video.mp4';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMenuOpen(false);
    } catch (e) {
      console.error('Download failed:', e);
      alert('Could not download this video.');
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showProgressBar = isHovered || isPlaying;

  return (
    <>
      <div
        className={`relative rounded-lg overflow-hidden ${isSent ? 'ml-auto' : 'mr-auto'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 3-dot menu */}
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <BsThreeDotsVertical />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-28 bg-white shadow-md rounded-md text-sm">
              <button
                onClick={handleDownload}
                className="w-full text-left px-3 py-2 hover:bg-gray-100"
              >
                Download
              </button>
            </div>
          )}
        </div>

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

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                w-12 h-12 rounded-full flex items-center justify-center
                ${isPlaying ? 'bg-white/30' : 'bg-white/80'} ${isSent ? 'text-green-600' : 'text-gray-600'}`}
            >
              {isPlaying ? <FaPause /> : <FaPlay />}
            </button>

            {showProgressBar && (
              <div className="absolute bottom-6 left-4 right-4 w-auto">
                <div className="h-1 bg-gray-300/40 rounded-full">
                  <div
                    className="h-full bg-green-500 mb-3 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[12px] text-white">
                  <div>{formatTime(currentTime)} / {formatTime(duration)}</div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setIsExpanded(true)}>
                      <RiFullscreenFill className='w-4 h-4'/>
                    </button>
                  </div>
                </div>

                <div className=' float-right mb-0 mt-2 text-[12px]'>
                      {timestamp ? new Date(timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      }) : "Unknown time"}
                      {isSent && (
                        seen ? <span className="text-blue-400"> ✓✓</span>
                          : delivered ? <span className="text-white"> ✓✓</span>
                            : <span className="text-white"> ✓</span>
                      )}
                    </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Expanded player */}
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
                  style={{ width: `${(expandedTime / (duration || 1)) * 100}%` }}
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