import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BsEmojiSmile } from "react-icons/bs";
import { useTextMessages } from "./TextMessageHandler";
import { useVoiceMessages } from "./VoiceMessageHandler";
import { useFileMessages } from "./FileMessageHandler";

const Chat = () => {

    const handleSignup = () => {
        window.location.href = "/signup";
    }

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [allMessages, setAllMessages] = useState([]);

    const socketRef = useRef();
    const messagesEndRef = useRef();

    const userName = localStorage.getItem("userName");
    const role = localStorage.getItem("role");

    // Helper function to add message to correct state
    const addMessageToState = (newMsg, messageType = 'text') => {
        console.log(`📝 Adding ${messageType} message to state:`, newMsg);

        if (role === "admin") {
            setAllMessages(prev => {
                const exists = prev.some(m => m.id === newMsg.id);
                if (exists) {
                    console.log("⚠️ Message already exists in admin messages");
                    return prev;
                }
                console.log("✅ Added message to admin messages");
                return [...prev, newMsg];
            });
        } else {
            if (newMsg.sender === userName || newMsg.receiver === userName ||
                newMsg.sender === "Admin" || newMsg.receiver === "Admin") {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === newMsg.id);
                    if (exists) {
                        console.log("⚠️ Message already exists in user messages");
                        return prev;
                    }
                    console.log("✅ Added message to user messages");
                    return [...prev, newMsg];
                });
            }
        }
    };

    // Initialize socket connection
    useEffect(() => {
        const socket = io("http://localhost:5000", {
            auth: {
                name: userName,
                role,
                serverOffset: "000000000000000000000000"
            }
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log("🔌 Connected to server, loading history...");
            socket.emit("load history");
        });

        return () => {
            console.log("🔌 Disconnecting from server...");
            socket.disconnect();
        };
    }, [userName, role]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, allMessages]);

    // Get filtered messages based on role
    const filteredMessages =
        role === "admin"
            ? allMessages.filter(
                (msg) =>
                    msg.sender === selectedUser || msg.receiver === selectedUser
            )
            : messages;

    // Get unique users that admin has chatted with
    const uniqueUsers =
        role === "admin"
            ? [...new Set(allMessages.map((msg) =>
                msg.sender === userName ? msg.receiver : msg.sender
            ))]
            : [...new Set(messages.map((msg) =>
                msg.sender !== userName ? msg.sender : msg.receiver
            ))];

    // Use the custom hooks for each functionality
    const { sendTextMessage } = useTextMessages(socketRef, userName, role, selectedUser, addMessageToState);
    const {
        isRecording,
        recordingTime,
        playingVoices,
        voiceProgress,
        pendingVoice,
        startRecording,
        stopRecording,
        sendVoiceMessage,
        toggleVoicePlayback,
        downloadVoice,
        formatTime,
        formatDuration,
        setPendingVoice,
        VoiceIcons
    } = useVoiceMessages(socketRef, userName, role, selectedUser, addMessageToState);
    const {
        fileInputRef,
        handleAttach,
        handleFileChange,
        getFileSizeInKB,
        AttachmentIcon
    } = useFileMessages(socketRef, userName, role, selectedUser, addMessageToState);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        sendTextMessage(input);
        setInput("");
    };

    return (
        <div className="w-full mx-auto mt-0 p-0 flex bg-green-200 gap-0 h-full">

            {/* User list sidebar */}
            {role === "admin" && (
                <div className="w-[300px] border-r pr-4">
                    <h3 className="font-semibold mb-2">Users</h3>
                    <ul>
                        {uniqueUsers.map((u) => (
                            <li
                                key={u}
                                onClick={() => setSelectedUser(u)}
                                className={`cursor-pointer p-2 rounded mb-1 ${selectedUser === u ? "bg-blue-100 font-bold" : "hover:bg-gray-100"
                                    }`}
                            >
                                {u}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {role === "user" && (
                <div className="w-[500px] p-4 bg-gray-300">
                    <h3 className="font-bold mb-4 text-2xl text-center p-5 rounded-xl underline bg-green-400">admin</h3>
                    <ul>
                        {uniqueUsers.map((u) => (
                            <li
                                key={u}
                                onClick={() => setSelectedUser(u)}
                                className={`cursor-pointer p-2 rounded mb-1 hover:bg-gray-100 p-3 hover:underline hover:font-bold`}
                            >
                                {u}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Main chat area */}
            <div className="h-full w-full bg-pink-300">
                <h2 className="text-xl font-semibold h-100 bg-yellow-300 mb-0 p-3">
                    Welcome, {userName} ({role})
                    {selectedUser && role === "admin" && (
                        <span className="text-sm text-gray-600 ml-2">
                            - Chatting with {selectedUser}
                        </span>
                    )}
                    <button onClick={handleSignup} className="float-right bg-blue-500 text-white px-4 py-1 rounded-full hover:bg-blue-600">ADD User</button>
                </h2>

                {/* Recording indicator */}
                {isRecording && (
                    <div className="bg-red-100 border border-red-300 rounded p-2 mb-2 flex items-center justify-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2"></div>
                        <span className="text-red-700 font-medium">
                            Recording... {formatTime(recordingTime)}
                        </span>
                    </div>
                )}

                {/* Pending voice message */}
                {pendingVoice && (
                    <div className="bg-yellow-100 border border-yellow-300 rounded p-3 mb-3">
                        <p className="mb-2 text-yellow-800 font-semibold">
                            Ready to send voice message ({formatDuration(pendingVoice.voiceDuration)})
                        </p>
                        <audio
                            controls
                            src={pendingVoice.voiceData}
                            className="w-full mb-2"
                        />
                        <div className="mt-2 flex gap-2">
                            <button
                                className="bg-green-500 text-white px-4 py-1 rounded hover:bg-green-600"
                                onClick={sendVoiceMessage}
                            >
                                Send Voice
                            </button>
                            <button
                                className="bg-gray-300 px-4 py-1 rounded hover:bg-gray-400"
                                onClick={() => setPendingVoice(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Messages list */}
                <div className="mb-0 flex flex-col bg-white p-4 rounded-lg shadow-inner w-full overflow-y-auto h-[690px]">
                    {filteredMessages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            {role === "admin" && !selectedUser
                                ? "Select a user to start chatting"
                                : "No messages yet"}
                        </div>
                    ) : (
                        filteredMessages.map((m, i) => (
                            <div key={m.id || i} className={`mb-3 max-w-[75%] px-4 py-2 rounded-lg ${m.sender === userName
                                ? "bg-blue-500 text-white self-end ml-auto"
                                : "bg-gray-200 text-black self-start mr-auto"
                                }`}>
                                <div className="text-xs font-semibold mb-1">
                                    {m.sender === userName ? "You" : m.sender}
                                </div>

                                {m.isVoice ? (
                                    <div className="flex items-center gap-2 min-w-[200px]">
                                        <button
                                            onClick={() => toggleVoicePlayback(m.id, m.voiceData, m.voiceDuration)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${m.sender === userName
                                                ? "bg-blue-600 hover:bg-blue-700 text-white"
                                                : "bg-gray-300 hover:bg-gray-400"}`}
                                        >
                                            {playingVoices[m.id] ? (
                                                <VoiceIcons.FaPause className="text-sm" />
                                            ) : (
                                                <VoiceIcons.FaPlay className="text-sm ml-1" />
                                            )}
                                        </button>

                                        <div className="flex-1 max-w-[140px] h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-100 ${m.sender === userName ? 'bg-blue-300' : 'bg-gray-500'}`}
                                                style={{
                                                    width: `${voiceProgress[m.id] || 0}%`
                                                }}
                                            />
                                        </div>

                                        <span className="text-xs opacity-75 min-w-[30px]">
                                            {formatDuration(m.voiceDuration || 0)}
                                        </span>

                                        <button
                                            onClick={() => downloadVoice(m.voiceData, `voice_${m.id}.webm`)}
                                            className={`text-sm transition-colors ${m.sender === userName
                                                ? "text-blue-200 hover:text-white"
                                                : "text-gray-600 hover:text-gray-800"}`}
                                        >
                                            <VoiceIcons.FaDownload />
                                        </button>
                                    </div>
                                ) : m.isFile ? (
                                    <div className="flex flex-col">
                                        <span className="font-semibold mb-2">{m.fileName}</span>
                                        {m.fileType && m.fileType.startsWith('image/') ? (
                                            <img
                                                src={m.fileData}
                                                alt={m.fileName}
                                                className="max-w-full h-auto max-h-40 rounded"
                                            />
                                        ) : (
                                            <div className="bg-gray-100 p-2 rounded">
                                                <a
                                                    href={m.fileData}
                                                    download={m.fileName}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    📎 Download {m.fileName} ({getFileSizeInKB(m.fileSize)} KB)
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p>{m.msg}</p>
                                )}

                                <div className="text-[10px] text-right mt-1 opacity-75">
                                    {new Date(m.time).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message input form */}
                <form onSubmit={handleSubmit} className="flex gap-0 bg-gray-700 mb-5">
                    <button
                        type="button"
                        className="ml-4 mr-0 w-16 h-16 text-white flex items-center justify-center"
                    >
                        <BsEmojiSmile className="w-8 h-8" />
                    </button>

                    <button
                        type="button"
                        onClick={handleAttach}
                        className="ml-2 mr-4 w-16 h-16 flex items-center justify-center text-white"
                    >
                        <AttachmentIcon className="w-8 h-8" />
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                    />

                    <input
                        className="flex-1 h-16 p-2 bg-gray-900 text-white focus:outline-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            role === "admin" && !selectedUser
                                ? "Select a user to start chatting..."
                                : "Type a message..."
                        }
                        disabled={role === "admin" && !selectedUser}
                    />

                    <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                        disabled={role === "admin" && !selectedUser}
                    >
                        Send
                    </button>

                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={role === "admin" && !selectedUser}
                        className={`ml-4 mr-4 w-16 h-16 flex items-center justify-center ${isRecording
                            ? "text-white"
                            : "text-white"
                            } disabled:bg-gray-200`}
                    >
                        {isRecording ? <VoiceIcons.MdStop /> : <VoiceIcons.MdOutlineKeyboardVoice className="w-8 h-8" />}
                    </button>
                </form>

            </div>


        </div>
    );
};

export default Chat;