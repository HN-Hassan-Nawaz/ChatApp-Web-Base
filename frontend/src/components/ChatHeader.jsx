import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';


export const formatTextMessage = (msg) => ({
    id: msg._id.toString(),
    content: msg.content,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    senderName: msg.senderName,
    receiverName: msg.receiverName,
    timestamp: msg.createdAt,
});


// export const formatTextMessage = (msg) => ({
//     id: msg._id.toString(),
//     content: msg.content,
//     senderId: msg.senderId,
//     receiverId: msg.receiverId,
//     senderName: msg.senderName,
//     receiverName: msg.receiverName,
//     timestamp: msg.createdAt,
//     delivered: msg.delivered,
//     seen: msg.seen,
// });



export const formatFileMessage = (msg) => ({
    id: msg._id.toString(),
    fileName: msg.fileName,
    fileType: msg.fileType,
    fileData: msg.fileData,
    fileSize: msg.fileSize || msg.fileData.length,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    senderName: msg.senderName,
    receiverName: msg.receiverName,
    timestamp: msg.createdAt,
    isVideo: msg.fileType?.startsWith('video/')
});


export const formatVoiceMessage = (msg) => ({
    id: msg._id.toString(),
    voiceData: msg.voiceData,
    voiceDuration: msg.voiceDuration,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    senderName: msg.senderName,
    receiverName: msg.receiverName,
    timestamp: msg.createdAt,
});


export const getLastSeenId = (socket) => {
    const lastSeen = socket.handshake.auth.serverOffset;
    if (!mongoose.Types.ObjectId.isValid(lastSeen)) return null;
    return new mongoose.Types.ObjectId(lastSeen);
};


export const emitMessagesToClient = (socket, messages) => {
    messages.forEach((msg) => {
        if (msg.isVoice) {
            socket.emit('voice received', formatVoiceMessage(msg));
        } else if (msg.isFile) {
            socket.emit('file received', formatFileMessage(msg));
        } else {
            socket.emit('chat message', formatTextMessage(msg));
        }
    });
};


export const loadInitialMessages = async (socket, userId, role) => {
    try {
        let messages;
        const lastSeen = getLastSeenId(socket);

        if (role === 'admin') {
            messages = await Message.find({
                $or: [{ senderId: userId }, { receiverId: userId }],
                ...(lastSeen && { _id: { $gt: lastSeen } }),
            }).sort({ createdAt: 1 });
        } else {
            const adminUser = await User.findOne({ role: 'admin' });
            if (!adminUser) {
                console.log('Admin user not found');
                return socket.emit('history loaded');
            }

            messages = await Message.find({
                $or: [
                    { senderId: userId, receiverId: adminUser._id },
                    { senderId: adminUser._id, receiverId: userId },
                ],
                ...(lastSeen && { _id: { $gt: lastSeen } }),
            }).sort({ createdAt: 1 });
        }

        console.log(`📚 Loading ${messages.length} messages for ${role} ${userId}`);
        emitMessagesToClient(socket, messages);
        socket.emit('history loaded');
    } catch (err) {
        console.error('Message loading error:', err);
        socket.emit('history loaded');
    }
};


export const handleTextMessage = async (socket, io, msgData, userId, name, role, callback) => {
    try {
        const { content, receiverId, receiverName } = msgData;
        const actualReceiver = role === 'admin' ? receiverName : 'hassan nawaz';
        const isReceiverOnline = io.sockets.adapter.rooms.get(receiverId?.toString())?.size > 0;

        const saved = await Message.create({
            content,
            senderId: userId,
            senderName: name,
            receiverId: role === 'admin' ? receiverId : (await User.findOne({ role: 'admin' }))._id,
            receiverName: actualReceiver,
            delivered: isReceiverOnline
        });

        const messageData = formatTextMessage(saved);
        io.emit('chat message', messageData);
        callback();
    } catch (err) {
        console.error('Text message error:', err);
        callback({ error: 'Failed to save message' });
    }

    // Send message to both sides
    io.to(receiverId?.toString()).emit('chat message', messageData);
    io.to(userId?.toString()).emit('chat message', messageData);
};


export const handleFileUpload = async (socket, io, fileData, userId, name, role, callback) => {
    try {
        const { fileName, fileData: fileContent, fileType, receiverName, tempId, isVideo } = fileData;
        const actualReceiver = role === 'admin' ? receiverName : 'hassan nawaz';

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (fileContent.length > maxSize) {
            throw new Error('File size exceeds 50MB limit');
        }

        // Validate video formats if it's a video
        if (isVideo) {
            const supportedVideoTypes = [
                'video/mp4',
                'video/webm',
                'video/quicktime', // .mov
                'video/x-msvideo' // .avi
            ];

            if (!supportedVideoTypes.includes(fileType)) {
                throw new Error('Unsupported video format. Please use MP4, WebM, MOV, or AVI');
            }
        }

        // Create message in database
        const newMsg = await Message.create({
            senderName: name,
            receiverName: actualReceiver,
            senderId: userId,
            receiverId: role === 'admin' ? fileData.receiverId : (await User.findOne({ role: 'admin' }))._id,
            isFile: true,
            fileName,
            fileType,
            fileData: fileContent,
            fileSize: fileContent.length,
            createdAt: new Date(),
        });

        // Format the response
        const fileMessage = {
            ...formatFileMessage(newMsg),
            tempId,
            isVideo: fileType.startsWith('video/') // Explicitly mark video files
        };

        // Broadcast to relevant clients
        if (isVideo) {
            io.emit('video received', fileMessage);
        } else {
            io.emit('file received', fileMessage);
        }

        callback({
            success: true,
            messageId: newMsg._id,
            fileType
        });

    } catch (err) {
        console.error('File upload error:', err);

        // Differentiate between validation errors and system errors
        const errorMessage = err.message.includes('Unsupported') ||
            err.message.includes('exceeds') ?
            err.message :
            'Failed to upload file';

        callback({
            success: false,
            error: errorMessage,
            tempId: fileData.tempId // Include tempId to help client clean up
        });
    }
};


export const handleVoiceUpload = async (socket, io, voiceData, userId, name, role, callback) => {
    try {
        console.log('📥 Voice upload triggered');
        console.log('📏 Voice data size:', (voiceData.voiceData.length / 1024).toFixed(2), 'KB');
        console.log('⏱ Duration:', voiceData.voiceDuration);

        const actualReceiver = role === 'admin' ? voiceData.receiverName : 'hassan nawaz';
        const duration = parseFloat(voiceData.voiceDuration) || 0;
        const validatedDuration = Math.max(0.1, Math.min(duration, 1800));

        const newMsg = await Message.create({
            senderName: name,
            receiverName: actualReceiver,
            senderId: userId,
            receiverId: role === 'admin' ? voiceData.receiverId : (await User.findOne({ role: 'admin' }))._id,
            isVoice: true,
            voiceData: voiceData.voiceData,
            voiceDuration: validatedDuration,
            createdAt: new Date(),
        });

        const voiceMessage = formatVoiceMessage(newMsg);
        io.emit('voice received', voiceMessage);
        callback({ success: true, messageId: newMsg._id.toString() });

    } catch (err) {
        console.error('❌ Voice upload error:', err);
        callback({ success: false, error: 'Failed to save voice message' });
    }
};


export function setupMessageHandlers(socket, userId, role, name, io) {
    socket.on('chat message', (msgData, clientOffset, callback) =>
        handleTextMessage(socket, io, msgData, userId, name, role, callback)
    );

    socket.on('file upload', (fileData, callback) =>
        handleFileUpload(socket, io, fileData, userId, name, role, callback)
    );

    socket.on('voice upload', (voiceData, callback) =>
        handleVoiceUpload(socket, io, voiceData, userId, name, role, callback)
    );


    socket.on("image upload", (imageData, callback) =>
        handleImageUpload(socket, io, imageData, userId, name, role, callback)
    );


    socket.on("mark messages seen", async ({ senderId, receiverId }) => {
        try {
            await Message.updateMany(
                { senderId, receiverId, seen: false },
                { seen: true, seenAt: new Date() }
            );

            io.to(senderId.toString()).emit("messages seen", { senderId, receiverId });
        } catch (err) {
            console.error("Failed to update seen:", err);
        }
    });
}



// image method 
export const handleImageUpload = async (socket, io, imageData, userId, name, role, callback) => {
    try {
        const actualReceiver = role === 'admin' ? imageData.receiverName : 'hassan nawaz';

        const newMsg = await Message.create({
            senderName: name,
            receiverName: actualReceiver,
            senderId: userId,
            receiverId: role === 'admin' ? imageData.receiverId : (await User.findOne({ role: 'admin' }))._id,
            isFile: true,
            isImage: true,
            fileName: imageData.fileName,
            fileType: imageData.fileType,
            fileData: imageData.fileData,
            createdAt: new Date()
        });

        const imageMessage = {
            id: newMsg._id.toString(),
            fileName: newMsg.fileName,
            fileType: newMsg.fileType,
            fileData: newMsg.fileData,
            senderId: newMsg.senderId,
            receiverId: newMsg.receiverId,
            senderName: newMsg.senderName,
            receiverName: newMsg.receiverName,
            timestamp: newMsg.createdAt,
            isImage: true
        };

        io.emit("image received", imageMessage);
        callback({ success: true, messageId: newMsg._id.toString() });

    } catch (err) {
        console.error("Image upload error:", err);
        callback({ success: false, error: "Failed to upload image" });
    }
};



















































 const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeUser) return;

        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        const maxSize = 50 * 1024 * 1024; // 50MB

        if (file.size > maxSize) {
            alert('File too large (max 50MB)');
            return;
        }

        const tempId = `temp-${Date.now()}`;

        // ✅ 1. Handle image upload separately
        if (isImage) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = reader.result.split(',')[1];

                socketRef.current.emit("image upload", {
                    fileName: file.name,
                    fileType: file.type,
                    fileData: base64Data,
                    receiverId: activeUser._id,
                    receiverName: activeUser.name,
                }, (response) => {
                    if (!response.success) {
                        alert(response.error);
                    }
                });
            };
            reader.readAsDataURL(file);
            return;
        }

        // ✅ 2. Handle video with chunked upload
        const supportedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
        if (isVideo) {
            if (!supportedVideoTypes.includes(file.type)) {
                alert('Unsupported video format. Please use MP4, WebM, MOV, or AVI');
                return;
            }

            const videoUrl = URL.createObjectURL(file);
            const uploadId = `vid-${Date.now()}-${Math.random()}`;
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

            // Show temporary preview message
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

            const blobToBase64 = blob => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

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
                            // ✅ Replace temp message with actual, including correct timestamp
                            setMessages(prev => prev.map(msg =>
                                msg.id === uploadId ? {
                                    ...msg,
                                    ...data.message,
                                    isVideo: true,
                                    isFile: true,
                                    isTemp: false,
                                    fileData: data.message.fileData,
                                    timestamp: new Date(data.message.timestamp || new Date())
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

            return;
        }

        // ✅ 3. Handle non-image, non-video files
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
                                                    isSent={isSent}
                                                />
                                            ) : msg.isFile && msg.fileType?.startsWith("video/") ? (
                                                // ✅ Video messages
                                                <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow ${isSent ? "bg-green-700 text-white ml-auto" : "bg-gray-700 text-white"}`}>
                                                    {msg.uploadStatus === "uploading" ? (
                                                        <div className="animate-pulse text-gray-300 text-sm py-2">
                                                            Uploading video...
                                                        </div>
                                                    ) : (
                                                        <VideoPlayer
                                                            videoUrl={`data:${msg.fileType};base64,${msg.fileData}`}
                                                            isSent={isSent}
                                                            isTemp={msg.isTemp} // optional, if needed
                                                            timestamp={msg.timestamp}
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
                                                />
                                            ) : msg.isFile ? (
                                                // ✅ Other file types (docs, zip, etc.)
                                                <FileMessageCard
                                                    fileName={msg.fileName}
                                                    fileType={msg.fileType}
                                                    fileData={msg.fileData}
                                                    fileSize={msg.fileSize}
                                                    timestamp={msg.timestamp}
                                                    isSent={isSent}
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

                                <button
                                    onClick={toggleRecording}
                                    className={`p-2 rounded-full ${isRecording ? 'bg-red-500 text-white' : 'text-gray-500'}`}
                                >
                                    <MdOutlineKeyboardVoice className="h-6 w-6" />
                                </button>

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