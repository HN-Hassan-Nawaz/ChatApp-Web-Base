import { useRef, useState, useEffect } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';
import { MdOutlineKeyboardVoice } from 'react-icons/md';

// 🧠 VoiceMessage Component = Recorder + Player in one reusable file
const VoiceMessage = ({
  isRecordingMode = false,
  voiceData = '',
  duration = 0,
  timestamp = new Date(),
  isSent = false,
  delivered = false,
  seen = false,
  socketRef = null,
  activeUser = null
}) => {
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const isDiscardedRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timer, setTimer] = useState("00:00");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const formatTime = (seconds) => {
    const secs = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(secs / 60);
    return `${mins}:${(secs % 60).toString().padStart(2, '0')}`;
  };

  // 🟢 Voice Recorder Logic
  const startTimer = () => {
    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
      setTimer(`${mins}:${secs}`);
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerIntervalRef.current);
    setTimer("00:00");
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    isDiscardedRef.current = false;
    recordingStartTimeRef.current = Date.now();

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (isDiscardedRef.current || !audioChunksRef.current.length || !activeUser) return;

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        socketRef?.current?.emit('voice upload', {
          voiceData: base64Data,
          voiceDuration: duration,
          receiverId: activeUser._id,
          receiverName: activeUser.name
        });
      };
      reader.readAsDataURL(audioBlob);
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start(1000);
    startTimer();
    setIsRecording(true);

    const timeoutId = setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 1800000);
    mediaRecorder.timeoutId = timeoutId;
  };

  const stopRecording = () => {
    clearTimeout(mediaRecorderRef.current?.timeoutId);
    mediaRecorderRef.current?.stop();
    stopTimer();
    setIsPaused(false);
    setIsRecording(false);
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
    clearInterval(timerIntervalRef.current);
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
    startTimer();
  };

  const discardRecording = () => {
    isDiscardedRef.current = true;
    stopRecording();
    audioChunksRef.current = [];
    setTimer("00:00");
  };

  const toggleRecording = () => {
    isRecording ? stopRecording() : startRecording();
  };

  // 🔊 Voice Playback Logic
  useEffect(() => {
    if (!voiceData || isRecordingMode) return;
    const audio = audioRef.current;
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleLoaded = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setAudioDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoaded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoaded);
    };
  }, [voiceData, isRecordingMode]);

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error("Playback error", err));
    }
    setIsPlaying(!isPlaying);
  };

  // 🎤 Recording Mode UI
  if (isRecordingMode) {
    return (
      <div className="bg-white border rounded p-4 max-w-md text-center shadow">
        <button
          onClick={toggleRecording}
          className={`p-2 rounded-full text-xl ${isRecording ? 'bg-red-500 text-white' : 'text-gray-600'}`}
        >
          <MdOutlineKeyboardVoice />
        </button>

        {isRecording && (
          <div className="mt-3 text-sm text-red-600">
            <p>Recording... {timer}</p>
            <div className="flex justify-center gap-3 mt-2 text-xs">
              {!isPaused ? (
                <button onClick={pauseRecording} className="bg-yellow-300 px-2 py-1 rounded">Pause</button>
              ) : (
                <button onClick={resumeRecording} className="bg-green-300 px-2 py-1 rounded">Resume</button>
              )}
              <button onClick={stopRecording} className="bg-blue-500 text-white px-2 py-1 rounded">Stop</button>
              <button onClick={discardRecording} className="bg-red-300 px-2 py-1 rounded">Discard</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 🔊 Playback Mode UI
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl shadow max-w-[80%] ${isSent
      ? "bg-green-700 text-white ml-auto w-96"
      : "bg-gray-700 text-white mr-auto w-72"
      }`}>
      <audio
        ref={audioRef}
        src={`data:audio/webm;base64,${voiceData}`}
        preload="metadata"
      />

      <button
        onClick={togglePlayPause}
        className={`w-12 h-12 rounded-full flex items-center justify-center ${isPlaying
          ? isSent ? "bg-white text-green-600" : "bg-green-500 text-white"
          : isSent ? "bg-white text-green-600" : "bg-white text-gray-600"
          }`}
      >
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono w-8">
            {formatTime(isPlaying ? currentTime : duration)}
          </span>
          <div className="flex-1 h-2 bg-white/40 rounded-full overflow-hidden">
            <div
              className={`h-full ${isSent ? "bg-white" : "bg-green-500"}`}
              style={{ width: `${Math.min(100, (currentTime / (duration || 1)) * 100)}%` }}
            />
          </div>
        </div>
        <div className={`text-[12px] ${isSent ? "text-black/70" : "text-white/70"} text-right -mb-4 flex items-center gap-1 justify-end`}>
          <span>{new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {isSent && (
            seen ? <span className="text-blue-400">✓✓</span>
              : delivered ? <span className="text-white">✓✓</span>
                : <span className="text-white">✓</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;