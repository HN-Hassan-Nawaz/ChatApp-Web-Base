import { useState, useRef,useEffect } from "react";
import { MdOutlineKeyboardVoice, MdStop } from "react-icons/md";
import { FaPlay, FaPause, FaDownload } from "react-icons/fa";

export const useVoiceMessages = (socketRef, userName, role, selectedUser, addMessageToState) => {
    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [playingVoices, setPlayingVoices] = useState({});
    const [voiceProgress, setVoiceProgress] = useState({});
    const [pendingVoice, setPendingVoice] = useState(null);

    const mediaRecorderRef = useRef();
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef();
    const audioElementsRef = useRef({});
    const progressIntervalsRef = useRef({});
    const audioMetaRef = useRef(null);

    // Handle incoming voice messages
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const handleIncomingVoice = (data) => {
            console.log("🎤 Received voice message:", data);
            const newMsg = {
                id: data.id,
                isVoice: true,
                isFile: false,
                voiceData: data.voiceData,
                voiceDuration: data.voiceDuration || 0,
                sender: data.senderName,
                receiver: data.receiverName,
                time: data.timestamp
            };
            addMessageToState(newMsg, 'voice');
        };

        socket.on("voice received", handleIncomingVoice);
        socket.on("voice upload error", (error) => {
            console.error("Voice upload error:", error);
            alert("Failed to upload voice message: " + error.message);
        });

        return () => {
            socket.off("voice received", handleIncomingVoice);
            socket.off("voice upload error");
        };
    }, [socketRef, addMessageToState]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                clearInterval(recordingIntervalRef.current);
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const objectURL = URL.createObjectURL(audioBlob);
                const tempAudio = new Audio(objectURL);
                audioMetaRef.current = tempAudio;

                tempAudio.onloadedmetadata = () => {
                    const duration = tempAudio.duration;
                    console.log("✅ Duration loaded from metadata:", duration);

                    const reader = new FileReader();
                    reader.onload = () => {
                        setPendingVoice({
                            voiceData: reader.result,
                            voiceDuration: duration,
                            receiverName: role === "admin" ? selectedUser : "Admin"
                        });
                    };
                    reader.readAsDataURL(audioBlob);
                    audioMetaRef.current = null;
                };

                tempAudio.onerror = () => {
                    console.warn("⚠️ Failed to get metadata. Fallback = 1");
                    const reader = new FileReader();
                    reader.onload = () => {
                        setPendingVoice({
                            voiceData: reader.result,
                            voiceDuration: 1,
                            receiverName: role === "admin" ? selectedUser : "Admin"
                        });
                    };
                    reader.readAsDataURL(audioBlob);
                    audioMetaRef.current = null;
                };

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start(100);
            setIsRecording(true);

        } catch (error) {
            console.error("🎤 Microphone access error:", error);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    const sendVoiceMessage = () => {
        if (!pendingVoice || pendingVoice.voiceDuration <= 0.5) {
            alert("Voice message too short");
            return;
        }

        console.log("🎤 Sending voice message:", pendingVoice);

        socketRef.current.emit("voice upload", pendingVoice, (response) => {
            console.log("📡 Voice upload response:", response);
            if (response?.success) {
                setPendingVoice(null);
                console.log("✅ Voice message sent successfully");
            } else {
                console.error("❌ Voice upload failed:", response);
                alert("Failed to send voice message");
            }
        });
    };

    const toggleVoicePlayback = async (messageId, voiceData, duration) => {
        console.log("🔊 Toggle voice playback:", { messageId, duration, isPlaying: playingVoices[messageId] });

        const existingAudio = audioElementsRef.current[messageId];

        if (existingAudio) {
            if (playingVoices[messageId]) {
                existingAudio.pause();
                existingAudio.currentTime = 0;
                setPlayingVoices(prev => ({ ...prev, [messageId]: false }));
                setVoiceProgress(prev => ({ ...prev, [messageId]: 0 }));

                if (progressIntervalsRef.current[messageId]) {
                    clearInterval(progressIntervalsRef.current[messageId]);
                    delete progressIntervalsRef.current[messageId];
                }
            } else {
                existingAudio.currentTime = 0;
                try {
                    await existingAudio.play();
                    setPlayingVoices(prev => ({ ...prev, [messageId]: true }));
                    startProgressTracking(messageId, existingAudio, duration);
                } catch (error) {
                    console.error("Error playing audio:", error);
                    setPlayingVoices(prev => ({ ...prev, [messageId]: false }));
                }
            }
        } else {
            const newAudio = new Audio(voiceData);
            audioElementsRef.current[messageId] = newAudio;

            newAudio.onended = () => {
                console.log("🔊 Audio ended for:", messageId);
                setPlayingVoices(prev => ({ ...prev, [messageId]: false }));
                setVoiceProgress(prev => ({ ...prev, [messageId]: 0 }));
                if (progressIntervalsRef.current[messageId]) {
                    clearInterval(progressIntervalsRef.current[messageId]);
                    delete progressIntervalsRef.current[messageId];
                }
            };

            newAudio.onerror = (error) => {
                console.error("Error playing voice message:", error);
                setPlayingVoices(prev => ({ ...prev, [messageId]: false }));
                setVoiceProgress(prev => ({ ...prev, [messageId]: 0 }));
                if (progressIntervalsRef.current[messageId]) {
                    clearInterval(progressIntervalsRef.current[messageId]);
                    delete progressIntervalsRef.current[messageId];
                }
            };

            newAudio.onloadedmetadata = () => {
                console.log(`🔊 Audio loaded for ${messageId}, duration: ${newAudio.duration}`);
            };

            try {
                await newAudio.play();
                setPlayingVoices(prev => ({ ...prev, [messageId]: true }));
                startProgressTracking(messageId, newAudio, duration);
                console.log("🔊 Started playing voice message");
            } catch (error) {
                console.error("Error playing new audio:", error);
                setPlayingVoices(prev => ({ ...prev, [messageId]: false }));
            }
        }
    };

    const startProgressTracking = (messageId, audio, totalDuration) => {
        if (progressIntervalsRef.current[messageId]) {
            clearInterval(progressIntervalsRef.current[messageId]);
        }

        progressIntervalsRef.current[messageId] = setInterval(() => {
            if (audio.currentTime && totalDuration) {
                const progress = (audio.currentTime / totalDuration) * 100;
                setVoiceProgress(prev => ({ ...prev, [messageId]: Math.min(progress, 100) }));
            }
        }, 100);
    };

    const downloadVoice = (base64Data, filename = "voice_message.webm") => {
        const link = document.createElement("a");
        link.href = base64Data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDuration = (seconds) => {
        if (typeof seconds !== 'number' || isNaN(seconds) || seconds === Infinity) {
            return "0:00";
        }
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return {
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
        VoiceIcons: { MdOutlineKeyboardVoice, MdStop, FaPlay, FaPause, FaDownload }
    };
};