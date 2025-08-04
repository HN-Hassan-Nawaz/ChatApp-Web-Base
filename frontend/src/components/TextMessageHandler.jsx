import { useEffect, useRef } from "react";

export const useTextMessages = (socketRef, userName, role, selectedUser, addMessageToState) => {
    const counterRef = useRef(0);

    // Handle incoming text messages
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        const handleIncomingMessage = (data) => {
            console.log("📨 Received text message:", data);
            const newMsg = {
                id: data.id,
                msg: data.content,
                sender: data.senderName,
                receiver: data.receiverName,
                time: data.timestamp,
                isFile: false,
                isVoice: false
            };
            addMessageToState(newMsg, 'text');
        };

        socket.on("chat message", handleIncomingMessage);

        return () => {
            socket.off("chat message", handleIncomingMessage);
        };
    }, [socketRef, addMessageToState]);

    const sendTextMessage = (input) => {
        if (!input.trim()) return;

        const clientOffset = `${socketRef.current.id}-${counterRef.current++}`;
        const receiver = role === "admin" ? selectedUser : "Admin";

        socketRef.current.emit(
            "chat message",
            {
                content: input,
                receiverName: receiver
            },
            clientOffset,
            () => { }
        );
    };

    return { sendTextMessage };
};