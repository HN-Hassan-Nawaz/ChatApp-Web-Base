import { useEffect, useRef } from "react";
import { GrAttachment } from "react-icons/gr";

export const useFileMessages = (socketRef, userName, role, selectedUser, addMessageToState) => {
    const fileInputRef = useRef();

    // Handle incoming file messages
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const handleIncomingFile = (data) => {
            console.log("📎 Received file message:", data);
            const newMsg = {
                id: data.id,
                isFile: true,
                isVoice: false,
                fileName: data.fileName,
                fileData: data.fileData,
                fileType: data.fileType,
                fileSize: data.fileSize,
                sender: data.senderName,
                receiver: data.receiverName,
                time: data.timestamp
            };
            addMessageToState(newMsg, 'file');
        };

        socket.on("file received", handleIncomingFile);
        socket.on("file upload error", (error) => {
            console.error("File upload error:", error);
            alert("Failed to upload file: " + error.message);
        });

        return () => {
            socket.off("file received", handleIncomingFile);
            socket.off("file upload error");
        };
    }, [socketRef, addMessageToState]);

    const handleAttach = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const receiver = role === "admin" ? selectedUser : "Admin";
            const base64Data = reader.result;

            socketRef.current.emit("file upload", {
                fileName: file.name,
                fileType: file.type,
                fileData: base64Data,
                receiverName: receiver,
            });
        };

        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const getFileSizeInKB = (fileSize) => {
        if (fileSize) {
            return Math.round(fileSize / 1024);
        }
        return 'Unknown';
    };

    return {
        fileInputRef,
        handleAttach,
        handleFileChange,
        getFileSizeInKB,
        AttachmentIcon: GrAttachment
    };
};