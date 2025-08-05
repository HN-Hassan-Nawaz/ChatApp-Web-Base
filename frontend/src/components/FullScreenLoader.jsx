import React from "react";

const FullScreenLoader = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-white border-dashed rounded-full animate-spin"></div>
                <p className="text-white text-lg">Loading...</p>
            </div>
        </div>
    );
};

export default FullScreenLoader;
