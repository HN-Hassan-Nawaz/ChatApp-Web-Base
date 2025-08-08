import { useEffect, useRef, useState } from 'react';
import Signup from './Signup';
import UserList from './UserList';
import VideoPlayer from './VideoPlayer';
import PicturePlayer from './PicturePlayer';
import FileMessageCard from './FileMessageCard'
import VoiceMessagePlayer from './VoiceMessagePlayer';
import VoiceMessage from './VoiceMessagePlayer';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ImAttachment } from "react-icons/im";
import { IoSend } from "react-icons/io5";
import { BsWhatsapp, BsLockFill } from 'react-icons/bs';

const WhatsAppClone = () => {
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


    const socketRef = useRef();
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleAttachClick = () => {
        fileInputRef.current.click(); // Triggers the hidden file input
    };


    const CHUNK_SIZE = 1024 * 1024; // 1MB

    const handleFileChange = async (e) => {
        try {
            const file = e.target?.files?.[0];
            if (!file || !activeUser) return;

            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');
            const maxSize = 50 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('File too large (max 50MB)');
                return;
            }

            e.target.value = '';

            // ===== IMAGES =====
            if (isImage) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Data = reader.result.split(',')[1];
                    socketRef.current.emit(
                        'image upload',
                        {
                            fileName: file.name,
                            fileType: file.type,
                            fileData: base64Data,
                            receiverId: activeUser._id,
                            receiverName: activeUser.name,
                        },
                        (res) => {
                            if (!res?.success) alert(res?.error || 'Image upload failed');
                        }
                    );
                };
                reader.readAsDataURL(file);
                return;
            }

            // ===== VIDEOS (chunked) =====
            if (isVideo) {
                const supported = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
                if (!supported.includes(file.type)) {
                    alert('Unsupported video format. Use MP4, WebM, MOV, or AVI');
                    return;
                }

                const uploadId = `vid-${Date.now()}-${Math.random()}`;
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

                // temp bubble with progress
                setMessages((prev) => [
                    ...prev,
                    {
                        id: uploadId,
                        isFile: true,
                        isVideo: true,
                        fileName: file.name,
                        fileType: file.type,
                        fileData: URL.createObjectURL(file),
                        senderId: userId,
                        receiverId: activeUser._id,
                        senderName: userName,
                        receiverName: activeUser.name,
                        timestamp: new Date(),
                        isTemp: true,
                        uploadStatus: 'uploading',
                        uploadProgress: 0,
                    },
                ]);

                const setProgress = (pct) =>
                    setMessages((prev) =>
                        prev.map((m) => (m.id === uploadId ? { ...m, uploadProgress: pct } : m))
                    );

                const blobToBase64 = (blob) =>
                    new Promise((resolve, reject) => {
                        const r = new FileReader();
                        r.onloadend = () => resolve(r.result);
                        r.onerror = reject;
                        r.readAsDataURL(blob);
                    });

                for (let index = 0; index < totalChunks; index++) {
                    const start = index * CHUNK_SIZE;
                    const end = Math.min(file.size, start + CHUNK_SIZE);
                    const chunk = file.slice(start, end);
                    const chunkBase64 = await blobToBase64(chunk);

                    await fetch('http://localhost:5000/api/video/upload-chunk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            uploadId,
                            chunkIndex: index,
                            totalChunks,
                            chunk: String(chunkBase64).split(',')[1],
                            fileName: file.name,
                            fileType: file.type,
                            receiverId: activeUser._id,
                            receiverName: activeUser.name,
                            senderId: userId,
                            senderName: userName,
                        }),
                    }).then((r) => r.json());

                    setProgress(Math.round(((index + 1) / totalChunks) * 100));
                }
                return;
            }

            // ===== OTHER FILES =====
            const reader = new FileReader();
            reader.onloadend = () => {
                socketRef.current.emit(
                    'file upload',
                    {
                        fileName: file.name,
                        fileType: file.type,
                        fileData: reader.result.split(',')[1],
                        receiverId: activeUser._id,
                        receiverName: activeUser.name,
                        isVideo: false,
                        tempId: `temp-${Date.now()}`,
                    },
                    (res) => {
                        if (!res?.success) alert(res?.error || 'File upload failed');
                    }
                );
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('handleFileChange error:', err);
            alert('Upload failed.');
        }
    };


    const messageIds = useRef(new Set());

    useEffect(() => {
        const socket = io("http://localhost:5000", {
            auth: { userId, name: userName, role }
        });
        socketRef.current = socket;

        setMessages([]);
        messageIds.current.clear();

        // clear any prior handlers (safety)
        socket.removeAllListeners();

        // Helper: normalize to string IDs
        const me = String(userId);

        socket.on("chat message", (msg) => {
            const mid = String(msg.id);
            if (!messageIds.current.has(mid)) {
                messageIds.current.add(mid);
                setMessages(prev => [...prev, { ...msg, id: mid }]);

                // If I'm the receiver, ack delivery
                if (String(msg.receiverId) === me) {
                    socket.emit("message delivered", { messageId: mid });
                }

                // If this chat is open, mark seen (pair-based is fine for text)
                if (String(msg.senderId) === String(activeUser?._id) && String(msg.receiverId) === me) {
                    socket.emit("mark messages seen", { senderId: activeUser._id, receiverId: me });
                }
            }
        });

        socket.on("image received", (m) => {
            const mid = String(m.id);
            if (!messageIds.current.has(mid)) {
                messageIds.current.add(mid);
                setMessages(prev => [...prev, { ...m, id: mid, isImage: true, delivered: !!m.delivered, seen: !!m.seen }]);

                if (String(m.receiverId) === me) {
                    socket.emit("message delivered", { messageId: mid });
                }
                // Mark THIS message seen by id when chat is open
                if (String(m.senderId) === String(activeUser?._id) && String(m.receiverId) === me) {
                    socket.emit("mark messages seen by ids", { messageIds: [mid] });
                }
            }
        });

        socket.on("file received", (m) => {
            const mid = String(m.id);
            if (!messageIds.current.has(mid)) {
                messageIds.current.add(mid);
                setMessages(prev => [...prev, { ...m, id: mid, isFile: true, delivered: !!m.delivered, seen: !!m.seen }]);

                if (String(m.receiverId) === me) {
                    socket.emit("message delivered", { messageId: mid });
                }
                if (String(m.senderId) === String(activeUser?._id) && String(m.receiverId) === me) {
                    socket.emit("mark messages seen by ids", { messageIds: [mid] });
                }
            }
        });

        socket.on("video received", (m) => {
            const mid = String(m.id);
            if (!messageIds.current.has(mid)) {
                messageIds.current.add(mid);

                setMessages(prev => {
                    if (m.tempId) {
                        // Replace temp bubble for the sender
                        const replaced = prev.map(msg =>
                            msg.id === m.tempId
                                ? {
                                    ...msg,
                                    ...m,
                                    id: mid,
                                    isTemp: false,
                                    uploadStatus: undefined,
                                    uploadProgress: undefined,
                                }
                                : msg
                        );
                        // If temp not found (rare), append instead
                        const hadTemp = prev.some(msg => msg.id === m.tempId);
                        return hadTemp ? replaced : [...replaced, { ...m, id: mid, isFile: true, isVideo: true }];
                    }
                    // Receiver: just append
                    return [...prev, { ...m, id: mid, isFile: true, isVideo: true }];
                });

                // delivery ack if I'm the receiver
                if (String(m.receiverId) === String(userId)) {
                    socket.emit("message delivered", { messageId: mid });
                }

                // if this chat is open, mark as seen instantly
                if (
                    String(m.senderId) === String(activeUser?._id) &&
                    String(m.receiverId) === String(userId)
                ) {
                    socket.emit("mark messages seen by ids", { messageIds: [mid] });
                }
            }
        });



        socket.on("voice received", (m) => {
            const mid = String(m.id);
            if (!messageIds.current.has(mid)) {
                messageIds.current.add(mid);
                setMessages(prev => [...prev, { ...m, id: mid, isVoice: true, delivered: !!m.delivered, seen: !!m.seen }]);

                if (String(m.receiverId) === me) {
                    socket.emit("message delivered", { messageId: mid });
                }
                if (String(m.senderId) === String(activeUser?._id) && String(m.receiverId) === me) {
                    socket.emit("mark messages seen by ids", { messageIds: [mid] });
                }
            }
        });

        // ✅ Batch delivery ack from server (history or late delivery)
        socket.on("messages delivered", ({ messageIds: ids = [] }) => {
            const idSet = new Set(ids.map(String));
            setMessages(prev =>
                prev.map(m => (idSet.has(String(m.id)) ? { ...m, delivered: true } : m))
            );
        });

        // ✅ Seen ack. Prefer IDs; fallback to pair if none provided
        socket.on("messages seen", ({ receiverId, messageIds = [] }) => {
            const idSet = new Set(messageIds.map(String));
            setMessages(prev =>
                prev.map(msg => {
                    if (idSet.size && idSet.has(String(msg.id))) {
                        return { ...msg, seen: true, seenAt: new Date(), delivered: true };
                    }
                    if (
                        !idSet.size &&
                        String(msg.senderId) === me &&
                        String(msg.receiverId) === String(receiverId)
                    ) {
                        return { ...msg, seen: true, seenAt: new Date(), delivered: true };
                    }
                    return msg;
                })
            );
        });


        socket.on("history loaded", () => {
            setHistoryLoaded(true);
            setTimeout(scrollToBottom, 100);
        });

        return () => socket.disconnect();
    }, [userId, userName, role, activeUser?._id]);


    useEffect(() => {
        const handleClickAnywhere = () => {
            if (
                activeUser &&
                socketRef.current &&
                messages.length > 0
            ) {
                const unseenExists = messages.some(
                    msg =>
                        msg.senderId === activeUser._id &&
                        msg.receiverId === userId &&
                        !msg.seen
                );

                if (unseenExists) {
                    socketRef.current.emit("mark messages seen", {
                        senderId: activeUser._id,
                        receiverId: userId,
                    });

                    console.log("🖱️ Page clicked - Marked messages as seen for:", activeUser.name);
                }
            }
        };

        document.addEventListener("click", handleClickAnywhere);

        return () => {
            document.removeEventListener("click", handleClickAnywhere);
        };
    }, [activeUser, messages, userId]);



    useEffect(() => {
        if (activeUser && socketRef.current) {
            socketRef.current.emit("mark messages seen", { senderId: activeUser._id, receiverId: userId });
        }
    }, [activeUser, userId]);



    // Load admin for regular users
    useEffect(() => {
        if (role !== 'admin') {
            fetch('http://localhost:5000/api/users/admin')
                .then(res => res.json())
                .then(data => {
                    setAdminUser(data);
                    // setActiveUser(data);
                });
        }
    }, [role]);


    useEffect(() => {
        const socket = socketRef.current;

        socket.on('user status updated', ({ userId: updatedId, isOnline, lastSeen }) => {
            // ✅ Update top header user status (active chat)
            setActiveUser(prev =>
                prev?._id === updatedId ? { ...prev, isOnline, lastSeen } : prev
            );
        });

        return () => {
            socket.off('user status updated');
        };
    }, []);


    // Auto-scroll when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);



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
                    socket={socketRef.current}
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
                                <span className="text-xs text-gray-500">
                                    {activeUser?.isOnline
                                        ? 'Online'
                                        : activeUser?.lastSeen
                                            ? `Last seen at ${new Date(activeUser.lastSeen).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}`
                                            : 'Offline'}
                                </span>
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

                                    // Handle unique key for React
                                    const messageKey = msg._id || msg.id || `${msg.timestamp}-${Math.random()}`;

                                    return (
                                        <div key={messageKey} className={`flex ${isSent ? "justify-end" : "justify-start"} mb-3`}>
                                            {msg.isImage || msg.fileType?.startsWith("image/") ? (
                                                // ✅ Image messages (primary check: isImage, fallback: fileType check)
                                                <PicturePlayer
                                                    fileData={msg.fileData}
                                                    fileName={msg.fileName}
                                                    timestamp={msg.timestamp}
                                                    isSent={msg.senderId === userId}
                                                    delivered={!!msg.delivered}
                                                    seen={!!msg.seen}
                                                />
                                            ) : msg.isFile && msg.fileType?.startsWith("video/") ? (
                                                // ✅ Video messages
                                                <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow ${isSent ? "bg-green-700 text-white ml-auto" : "bg-gray-700 text-white"}`}>
                                                    {msg.isTemp && msg.uploadStatus === "uploading" ? (
                                                        <div className="animate-pulse text-gray-300 text-sm py-2">
                                                            Uploading video… {msg.uploadProgress ?? 0}%
                                                        </div>
                                                    ) : (
                                                        <VideoPlayer
                                                            videoUrl={`data:${msg.fileType};base64,${msg.fileData}`}
                                                            fileName={msg.fileName || 'video.mp4'}
                                                            isTemp={msg.isTemp}
                                                            timestamp={msg.timestamp}
                                                            isSent={msg.senderId === userId}
                                                            delivered={msg.delivered}
                                                            seen={msg.seen}
                                                        />
                                                    )}
                                                </div>
                                            ) : msg.isVoice ? (
                                                // ✅ Voice messages
                                                <VoiceMessagePlayer
                                                    voiceData={msg.voiceData}
                                                    duration={msg.voiceDuration}
                                                    senderName={msg.senderName}
                                                    timestamp={msg.timestamp}
                                                    isSent={isSent}
                                                    delivered={msg.delivered}
                                                    seen={msg.seen}
                                                />
                                            ) : msg.isFile ? (
                                                // ✅ Other file types (docs, zip, etc.)
                                                <FileMessageCard
                                                    fileName={msg.fileName}
                                                    fileType={msg.fileType}
                                                    fileData={msg.fileData}     // base64 only (no data: prefix) OR full data URL (both supported)
                                                    fileSize={msg.fileSize}     // in bytes
                                                    timestamp={msg.timestamp}
                                                    isSent={msg.senderId === userId}
                                                    delivered={msg.delivered}
                                                    seen={msg.seen}
                                                />
                                            ) : (
                                                // ✅ Text message
                                                <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow ${isSent ? "bg-green-700 text-white ml-auto" : "bg-gray-700 text-white"}`}>
                                                    <p className="text-[15px] leading-snug break-words mr-4 ml-1">{msg.content}</p>
                                                    <div className={`mt-1 flex items-center gap-1 text-[11px] ${isSent ? "text-black/60" : "text-gray-500"} justify-end`}>
                                                        <span>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                        {isSent && (
                                                            msg.seen ? (
                                                                <span className="text-blue-500">✓✓</span>
                                                            ) : msg.delivered ? (
                                                                <span className="text-white">✓✓</span>
                                                            ) : (
                                                                <span className="text-white">✓</span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            }
                            < div ref={messagesEndRef} />
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
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && input.trim()) {
                                            socketRef.current.emit("chat message", {
                                                content: input.trim(),
                                                senderId: userId,
                                                senderName: userName,
                                                receiverId: activeUser._id,
                                                receiverName: activeUser.name,
                                            });
                                            setInput(""); // ✅ Clear input right after sending
                                        }
                                    }}
                                    placeholder="Type a message"
                                    className="flex-1 p-2 mx-2 rounded-full border border-gray-300 focus:outline-none focus:border-green-500"
                                />

                                {/* Send Button */}
                                {input.trim() && (
                                    <button
                                        onClick={() => {
                                            socketRef.current.emit("chat message", {
                                                content: input.trim(),
                                                senderId: userId,
                                                senderName: userName,
                                                receiverId: activeUser._id,
                                                receiverName: activeUser.name,
                                            });
                                            setInput(""); // ✅ Clear input right after sending
                                        }}
                                        className="p-2 text-green-500"
                                    >
                                        <IoSend className="h-6 w-6" />
                                    </button>
                                )}

                                <VoiceMessage
                                    isRecordingMode={true}
                                    socketRef={socketRef}
                                    activeUser={activeUser}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-gray-100 text-white">
                        <BsWhatsapp className="text-[90px] text-gray-500 mb-6" />

                        <h2 className="text-2xl font-semibold text-black">WhatsApp for Windows</h2>

                        <p className="text-gray-500 mt-2 text-sm text-center px-4 max-w-md">
                            Send and receive messages without keeping your phone online.<br />
                            Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
                        </p>

                        <div className="absolute bottom-4 flex items-center text-gray-500 text-xs">
                            <BsLockFill className="mr-1 text-sm" />
                            End-to-end encrypted
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppClone;