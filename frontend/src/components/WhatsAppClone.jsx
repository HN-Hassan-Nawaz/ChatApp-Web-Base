import { useEffect, useRef, useState } from 'react';
import Signup from './Signup';
import UserList from './UserList';
import VideoPlayer from './VideoPlayer';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ImAttachment } from "react-icons/im";
import { MdOutlineKeyboardVoice } from "react-icons/md";
import { IoSend } from "react-icons/io5";
import { FaPlay, FaPause } from "react-icons/fa";

const WhatsAppClone = () => {
    // State and ref initialization
    const location = useLocation();
    const locationData = location.state || {};
    const userId = locationData.userId || localStorage.getItem('userId');
    const userName = locationData.userName || localStorage.getItem('userName');
    const role = locationData.role || localStorage.getItem('role');

    const [activeUser, setActiveUser] = useState(null);
    const [adminUser, setAdminUser] = useState(null);
    const [isSignupOpen, setIsSignupOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [timer, setTimer] = useState("00:00");
    const timerIntervalRef = useRef(null);
    const recordingStartTimeRef = useRef(null);


    const socketRef = useRef();
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const messagesEndRef = useRef(null);
    const isDiscardedRef = useRef(false);


    const VoiceMessagePlayer = ({ voiceData, duration = 0, senderName, timestamp, isSent }) => {
        const audioRef = useRef(null);
        const [isPlaying, setIsPlaying] = useState(false);
        const [currentTime, setCurrentTime] = useState(0);
        const [audioDuration, setAudioDuration] = useState(0);

        // Format time as MM:SS
        const formatTime = (seconds) => {
            const secs = Math.max(0, Math.floor(seconds));
            const mins = Math.floor(secs / 60);
            const remainingSecs = secs % 60;
            return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
        };

        useEffect(() => {
            const audio = audioRef.current;
            if (!audio) return;

            // Set initial duration from props (fallback to 0 if invalid)
            const initialDuration = Math.max(0, Math.min(Number(duration), 1800));
            setAudioDuration(initialDuration);

            const handleLoadedMetadata = () => {
                // Use the actual audio duration when available
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
        }, [duration, voiceData]);

        const togglePlayPause = () => {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(err => {
                    console.error("Playback failed:", err);
                    setIsPlaying(false);
                });
            }
            setIsPlaying(!isPlaying);
        };

        return (
            <div className={`flex items-center gap-3 p-3 rounded-2xl shadow max-w-[80%] ${isSent
                ? "bg-green-700 text-white ml-auto w-96"
                : "bg-gray-700 text-white mr-auto w-72"
                }`}
            >
                {/* Only show avatar if received */}
                {/* {!isSent && (
                    <div className="w-8 h-8 rounded-full bg-red-300 text-gray-800 flex items-center justify-center font-bold text-lg -mt-14">
                        {senderName?.charAt(0).toLowerCase()}
                    </div>
                )} */}

                {/* Audio Element */}
                <audio
                    ref={audioRef}
                    src={`data:audio/webm;base64,${voiceData}`}
                    preload="metadata"
                />

                {/* Play / Pause Button */}
                <button
                    onClick={togglePlayPause}
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${isPlaying
                        ? isSent
                            ? "bg-white text-green-600"
                            : "bg-green-500 text-white"
                        : isSent
                            ? "bg-white text-green-600"
                            : "bg-white text-gray-600"
                        }`}
                >
                    {isPlaying ? <FaPause /> : <FaPlay />}
                </button>



                {/* Waveform & Time */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono w-8">
                            {formatTime(isPlaying ? currentTime : audioDuration)}
                        </span>
                        <div className="flex-1 h-2 bg-white/40 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${isSent ? "bg-white" : "bg-green-500"}`}
                                style={{ width: `${Math.min(100, (currentTime / (audioDuration || 1)) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className={`text-[12px] ${isSent ? "text-black/70" : "text-white/70"} text-right -mb-4`}>
                        {new Date(timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </div>
                </div>
            </div>
        );
    };


    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };


    // Add this with your other handler functions in WhatsAppClone.jsx
    const handleAttachClick = () => {
        fileInputRef.current.click(); // Triggers the hidden file input
    };

    const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeUser) return;

        const isVideo = file.type.startsWith('video/');
        const maxSize = 50 * 1024 * 1024; // 50MB
        const supportedVideoTypes = [
            'video/mp4',
            'video/webm',
            'video/quicktime', // MOV
            'video/x-msvideo'  // AVI
        ];

        if (file.size > maxSize) {
            alert('File too large (max 50MB)');
            return;
        }

        if (isVideo && !supportedVideoTypes.includes(file.type)) {
            alert('Unsupported video format. Please use MP4, WebM, MOV, or AVI');
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const uploadId = `vid-${Date.now()}-${Math.random()}`;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        // Show loading preview for video
        if (isVideo) {
            const videoUrl = URL.createObjectURL(file);
            setMessages(prev => [...prev, {
                id: uploadId,
                isFile: true,
                isVideo: true,
                fileName: file.name,
                fileType: file.type,
                fileData: videoUrl,
                senderId: userId,
                receiverId: activeUser._id,
                senderName: userName,
                receiverName: activeUser.name,
                timestamp: new Date(),
                isTemp: true,
                uploadStatus: 'uploading'
            }]);
        }

        // Helper to convert blob to base64
        const blobToBase64 = blob => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        // Upload video in chunks
        if (isVideo) {
            for (let index = 0; index < totalChunks; index++) {
                const start = index * CHUNK_SIZE;
                const end = Math.min(file.size, start + CHUNK_SIZE);
                const chunk = file.slice(start, end);
                const chunkBase64 = await blobToBase64(chunk);

                await fetch("http://localhost:5000/api/video/upload-chunk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        uploadId,
                        chunkIndex: index,
                        totalChunks,
                        chunk: chunkBase64.split(',')[1],
                        fileName: file.name,
                        fileType: file.type,
                        receiverId: activeUser._id,
                        receiverName: activeUser.name,
                        senderId: userId,
                        senderName: userName
                    })
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.message?.fileData) {
                            // Replace temp message with real message
                            setMessages(prev => prev.map(msg =>
                                msg.id === uploadId ? {
                                    ...data.message,
                                    isVideo: true
                                } : msg
                            ));
                        }
                    })
                    .catch(err => {
                        console.error('Video chunk upload error:', err);
                        alert('Video upload failed.');
                        setMessages(prev => prev.filter(msg => msg.id !== uploadId));
                    });
            }

            return; // Don't process as a regular file
        }

        // ===== Regular (non-video) file upload =====
        const reader = new FileReader();

        reader.onload = (event) => {
            socketRef.current.emit("file upload", {
                fileName: file.name,
                fileType: file.type,
                fileData: event.target.result.split(',')[1],
                receiverId: activeUser._id,
                receiverName: activeUser.name,
                isVideo: false,
                tempId
            }, (response) => {
                if (!response.success) {
                    alert(response.error);
                    return;
                }
            });
        };

        reader.onerror = () => {
            alert('Error reading file');
        };

        reader.readAsDataURL(file);
    };



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
        try {
            // Always stop any existing recording first
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }

            // Clear previous chunks
            audioChunksRef.current = [];
            isDiscardedRef.current = false;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            recordingStartTimeRef.current = Date.now();

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // ✅ Check if discarded (no chunks) → do nothing
                if (isDiscardedRef.current || !audioChunksRef.current.length || !activeUser) return;

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Data = reader.result.split(',')[1];
                    const duration = (Date.now() - recordingStartTimeRef.current) / 1000;

                    socketRef.current.emit("voice upload", {
                        voiceData: base64Data,
                        voiceDuration: duration,
                        receiverId: activeUser._id,
                        receiverName: activeUser.name
                    });
                };
                reader.readAsDataURL(audioBlob);

                // Clean up
                audioChunksRef.current = [];
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(1000); // Collect data every second
            startTimer();
            setIsRecording(true);

            // 30 minute timeout (30 * 60 * 1000 = 1800000 ms)
            const timeoutId = setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 1800000);

            // Store timeout ID to clear if stopped manually
            mediaRecorderRef.current.timeoutId = timeoutId;

        } catch (err) {
            console.error("Recording error:", err);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            // Clear the auto-stop timeout
            clearTimeout(recorder.timeoutId);
            recorder.stop();
        }

        stopTimer();
        setIsPaused(false);
        setIsRecording(false);
    };


    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            clearInterval(timerIntervalRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            startTimer();
        }
    };

    const discardRecording = () => {
        isDiscardedRef.current = true;
        stopRecording();
        audioChunksRef.current = [];
        setTimer("00:00");
        setIsPaused(false);
    };



    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };


    const messageIds = useRef(new Set());

    useEffect(() => {
        const socket = io("http://localhost:5000", {
            auth: { userId, name: userName, role }
        });

        socketRef.current = socket;

        // ✅ Clear previous messages and IDs on reload
        setMessages([]);
        messageIds.current.clear();

        // ✅ Prevent duplicated listeners
        socket.removeAllListeners("chat message");
        socket.removeAllListeners("file received");
        socket.removeAllListeners("voice received");
        socket.removeAllListeners("video received");
        socket.removeAllListeners("history loaded");

        // ✅ Handle text message
        socket.on("chat message", (msg) => {
            if (!messageIds.current.has(msg.id)) {
                messageIds.current.add(msg.id);
                setMessages(prev => [...prev, msg]);
            }
        });

        // ✅ Handle file message
        socket.on("file received", (fileMsg) => {
            if (!messageIds.current.has(fileMsg.id)) {
                messageIds.current.add(fileMsg.id);
                setMessages(prev => [...prev, { ...fileMsg, isFile: true }]);
            }
        });

        // ✅ Handle voice message
        socket.on("voice received", (voiceMsg) => {
            if (!messageIds.current.has(voiceMsg.id)) {
                messageIds.current.add(voiceMsg.id);
                setMessages(prev => [...prev, { ...voiceMsg, isVoice: true }]);
            }
        });

        // ✅ Handle chunked video message
        socket.on("video received", (videoMsg) => {
            if (!messageIds.current.has(videoMsg.id)) {
                messageIds.current.add(videoMsg.id);
                // Remove the temp preview
                setMessages(prev => {
                    const filtered = prev.filter(msg => msg.id !== videoMsg.tempId);
                    return [...filtered, { ...videoMsg, isVideo: true }];
                });
            }
        });

        // ✅ Scroll after full history loads
        socket.on('history loaded', () => {
            setHistoryLoaded(true);
            setTimeout(scrollToBottom, 100);
        });

        return () => {
            socket.disconnect();
        };
    }, [userId, userName, role]);




    // Load admin for regular users
    useEffect(() => {
        if (role !== 'admin') {
            fetch('http://localhost:5000/api/users/admin')
                .then(res => res.json())
                .then(data => {
                    setAdminUser(data);
                    setActiveUser(data);
                });
        }
    }, [role]);

    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Message rendering helpers
    const renderFileMessage = (msg) => (
        <div className="max-w-xs">
            <div className="font-semibold text-blue-600">📎 {msg.fileName}</div>
            <a
                href={`data:${msg.fileType};base64,${msg.fileData}`}
                download={msg.fileName}
                className="text-blue-500 hover:underline block mt-1"
            >
                Download ({Math.round(msg.fileSize / 1024)}KB)
            </a>
        </div>
    );

    // Main render
    return (
        <div className="flex h-screen bg-gray-100 w-full">
            {isSignupOpen && <Signup onClose={() => setIsSignupOpen(false)} />}

            {/* Sidebar */}
            <div className="w-[400px] border-r border-gray-300 bg-white flex flex-col">
                <div className="p-3 bg-gray-100 mb-2">
                    <h1 className="text-xl font-semibold">WhatsApp Clone</h1>
                    <p>Welcome, {userName} ({role})</p>
                </div>

                {role === 'admin' && (
                    <button
                        onClick={() => setIsSignupOpen(true)}
                        className="mx-2 my-1 px-3 py-2 bg-green-500 text-white rounded-md text-lg hover:bg-green-600"
                    >
                        Add User
                    </button>
                )}

                <UserList
                    onUserClick={setActiveUser}
                    activeUserId={activeUser?._id}
                    isAdmin={role === 'admin'}
                    filteredUsers={role === 'admin' ? [] : adminUser ? [adminUser] : []}
                />
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {activeUser ? (
                    <>
                        <div className="p-3 bg-gray-100 border-b border-gray-300 flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                                {activeUser.name.charAt(0)}
                            </div>
                            <div className="ml-3">
                                <h3 className="font-semibold">{activeUser.name}</h3>
                                <p className="text-xs text-gray-500">Online</p>
                            </div>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                            {messages
                                .filter(
                                    (msg) =>
                                        (msg.senderId === userId && msg.receiverId === activeUser._id) ||
                                        (msg.senderId === activeUser._id && msg.receiverId === userId)
                                )
                                .map((msg) => {
                                    const isSent = msg.senderId === userId;

                                    return (
                                        <div
                                            key={msg._id || msg.id || `${msg.timestamp}-${Math.random()}`}
                                            className={`flex ${isSent ? "justify-end" : "justify-start"} mb-3`}
                                        >
                                            {/* Video messages */}
                                            {msg.isFile && msg.fileType.startsWith('video/') ? (
                                                <div
                                                    className={`max-w-[75%] rounded-2xl px-3 py-2 shadow ${isSent ? "bg-green-700 text-white ml-auto" : "bg-gray-700 text-white"
                                                        }`}
                                                >
                                                    {msg.uploadStatus === 'uploading' ? (
                                                        <div className="animate-pulse text-gray-300 text-sm py-2">
                                                            Uploading video...
                                                        </div>
                                                    ) : (
                                                        <VideoPlayer
                                                            videoUrl={`data:${msg.fileType};base64,${msg.fileData}`}
                                                            isSent={isSent}
                                                        />
                                                    )}
                                                    <div
                                                        className={`mt-1 flex items-center gap-1 text-[11px] ${isSent ? "text-black/60" : "text-gray-500"
                                                            } justify-end`}
                                                    >
                                                        <span>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : msg.isVoice ? (
                                                <VoiceMessagePlayer
                                                    voiceData={msg.voiceData}
                                                    duration={msg.voiceDuration}
                                                    senderName={msg.senderName}
                                                    timestamp={msg.timestamp}
                                                    isSent={isSent}
                                                />
                                            ) : (
                                                // Text & File messages: WhatsApp-like bubble
                                                <div
                                                    className={`max-w-[75%] rounded-2xl px-3 py-2 shadow ${isSent ? "bg-green-700 text-white ml-auto" : "bg-gray-700 text-white"
                                                        }`}
                                                >
                                                    {msg.isFile ? (
                                                        // File bubble
                                                        <div className="flex items-start gap-2">
                                                            <div className="font-semibold text-white truncate">
                                                                📎 {msg.fileName}
                                                            </div>
                                                            <a
                                                                href={`data:${msg.fileType};base64,${msg.fileData}`}
                                                                download={msg.fileName}
                                                                className="text-black mr-4 ml-4 underline hover:underline whitespace-nowrap"
                                                            >
                                                                Download
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        // Text bubble
                                                        <p className="text-[15px] leading-snug break-words mr-4 ml-1">{msg.content}</p>
                                                    )}

                                                    {/* time (and ticks for sent) */}
                                                    <div
                                                        className={`mt-1 flex items-center gap-1 text-[11px] ${isSent ? "text-black/60" : "text-gray-500"
                                                            } justify-end`}
                                                    >
                                                        <span>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            <div ref={messagesEndRef} />
                        </div>


                        <div className="p-3 bg-gray-100 border-t border-gray-300">
                            <div className="flex items-center">
                                <button onClick={handleAttachClick} className="p-2 text-gray-500">
                                    <ImAttachment className="h-6 w-6" />
                                </button>

                                {/* Video file input (add this right after attachment button) */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi"
                                />

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="*"
                                />

                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && input.trim() && socketRef.current.emit("chat message", {
                                        content: input,
                                        senderId: userId,
                                        senderName: userName,
                                        receiverId: activeUser._id,
                                        receiverName: activeUser.name
                                    }, () => setInput(""))}
                                    placeholder="Type a message"
                                    className="flex-1 p-2 mx-2 rounded-full border border-gray-300 focus:outline-none focus:border-green-500"
                                />

                                <button
                                    onClick={toggleRecording}
                                    className={`p-2 rounded-full ${isRecording ? 'bg-red-500 text-white' : 'text-gray-500'}`}
                                >
                                    <MdOutlineKeyboardVoice className="h-6 w-6" />
                                </button>

                                {input.trim() && (
                                    <button
                                        onClick={() => {
                                            socketRef.current.emit("chat message", {
                                                content: input,
                                                senderId: userId,
                                                senderName: userName,
                                                receiverId: activeUser._id,
                                                receiverName: activeUser.name
                                            });
                                            setInput("");
                                        }}
                                        className="p-2 text-green-500"
                                    >
                                        <IoSend className="h-6 w-6" />
                                    </button>
                                )}
                            </div>
                            {isRecording && (
                                <div className="mt-2 text-sm flex flex-col items-center justify-center text-red-600">
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono">{timer}</span>
                                        {!isPaused ? (
                                            <button
                                                onClick={pauseRecording}
                                                className="bg-yellow-300 hover:bg-yellow-400 text-black px-3 py-1 rounded text-xs"
                                            >
                                                Pause
                                            </button>
                                        ) : (
                                            <button
                                                onClick={resumeRecording}
                                                className="bg-green-300 hover:bg-green-400 text-black px-3 py-1 rounded text-xs"
                                            >
                                                Resume
                                            </button>
                                        )}
                                        <button
                                            onClick={discardRecording}
                                            className="bg-red-300 hover:bg-red-400 text-black px-3 py-1 rounded text-xs"
                                        >
                                            Discard
                                        </button>
                                    </div>
                                    <p className="mt-1">Recording... Click mic to stop</p>
                                </div>
                            )}

                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <h3 className="mt-2 text-lg font-medium text-gray-900">Select a chat</h3>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppClone;