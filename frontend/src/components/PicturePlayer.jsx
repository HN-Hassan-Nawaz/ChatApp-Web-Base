import React, { useState } from 'react';
import { IoClose } from 'react-icons/io5';

const PicturePlayer = ({ fileData, fileName, timestamp, isSent, delivered, seen }) => {
    const base64Url = `data:image/*;base64,${fileData}`;
    const [isFullView, setIsFullView] = useState(false);

    const renderTick = () => {
        if (seen) return <span className="text-blue-400 ml-1">✓✓</span>;
        if (delivered) return <span className="text-white ml-1">✓✓</span>;
        return <span className="text-white ml-1">✓</span>;
    };

    return (
        <>
            {/* Small image preview in chat bubble */}
            <div
                className={`rounded-xl shadow-md max-w-[60%] overflow-hidden relative cursor-pointer ${isSent ? 'ml-auto bg-green-700' : 'mr-auto bg-gray-700'
                    }`}
                onClick={() => setIsFullView(true)}
            >
                <img
                    src={base64Url}
                    alt={fileName}
                    className="w-full h-auto max-h-[450px] object-cover"
                />
                <div
                    className={`absolute bottom-1 right-2 text-[12px] flex items-center gap-1 ${isSent ? 'text-white/80' : 'text-white/70'
                        }`}
                >
                    {new Date(timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                    {isSent && renderTick()}
                </div>
            </div>

            {/* Fullscreen image preview */}
            {isFullView && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
                    {/* Close icon */}
                    <button
                        onClick={() => setIsFullView(false)}
                        className="absolute top-4 right-4 text-white text-3xl p-1 hover:text-red-400"
                    >
                        <IoClose />
                    </button>

                    {/* Full image */}
                    <img
                        src={base64Url}
                        alt={fileName}
                        className="max-w-[90%] max-h-[90%] object-contain shadow-lg rounded-lg"
                    />
                </div>
            )}
        </>
    );
};

export default PicturePlayer;