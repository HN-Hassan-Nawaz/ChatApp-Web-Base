import React, { useEffect, useMemo, useState, useCallback } from "react";
import { IoClose } from "react-icons/io5";

const PicturePlayer = ({ fileData, fileName, timestamp, isSent, delivered, seen }) => {
    // Accept either raw base64 or already-prefixed data URL
    const imgSrc = useMemo(() => {
        if (!fileData) return "";
        return fileData.startsWith("data:") ? fileData : `data:image/*;base64,${fileData}`;
    }, [fileData]);

    const [isFullView, setIsFullView] = useState(false);

    const renderTick = () => {
        if (!isSent) return null; // ticks only for sender
        if (seen) return <span className="text-blue-400 ml-1">✓✓</span>;     // seen
        if (delivered) return <span className="text-white ml-1">✓✓</span>;   // delivered
        return <span className="text-white ml-1">✓</span>;                   // sent
    };

    const safeTime = useMemo(() => {
        const d = timestamp ? new Date(timestamp) : null;
        return d && !isNaN(d) ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
    }, [timestamp]);

    // Close on ESC
    const onKeyDown = useCallback((e) => {
        if (e.key === "Escape") setIsFullView(false);
    }, []);

    useEffect(() => {
        if (!isFullView) return;
        document.addEventListener("keydown", onKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = "";
        };
    }, [isFullView, onKeyDown]);

    return (
        <>
            {/* Chat bubble image */}
            <div
                className={`rounded-xl shadow-md max-w-[60%] overflow-hidden relative cursor-pointer ${isSent ? "ml-auto bg-green-700" : "mr-auto bg-gray-700"
                    }`}
                onClick={() => setIsFullView(true)}
                role="button"
                aria-label="Open image"
                tabIndex={0}
            >
                <img
                    src={imgSrc}
                    alt={fileName || "image"}
                    className="w-full h-auto max-h-[450px] object-cover"
                    draggable={false}
                />
                <div
                    className={`absolute bottom-1 right-2 text-[12px] flex items-center gap-1 ${isSent ? "text-white/80" : "text-white/70"
                        }`}
                >
                    <span>{safeTime}</span>
                    {renderTick()}
                </div>
            </div>

            {/* Fullscreen viewer */}
            {isFullView && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
                    onClick={() => setIsFullView(false)}
                >
                    {/* stop propagation so click on image doesn't close */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setIsFullView(false)}
                            className="absolute -top-10 right-0 text-white text-3xl p-1 hover:text-red-400"
                            aria-label="Close"
                        >
                            <IoClose />
                        </button>
                        <img
                            src={imgSrc}
                            alt={fileName || "image"}
                            className="max-w-[90vw] max-h-[85vh] object-contain shadow-lg rounded-lg"
                        />
                        {fileName && (
                            <div className="mt-2 text-center text-white/80 text-sm">{fileName}</div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default PicturePlayer;