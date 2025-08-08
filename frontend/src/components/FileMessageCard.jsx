import React, { useMemo } from "react";
import {
    FaFilePdf,
    FaFileWord,
    FaFilePowerpoint,
    FaFileExcel,
    FaFileAlt,
    FaFileArchive,
    FaDownload,
} from "react-icons/fa";

/* =============== Helpers =============== */

const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${Math.round(value * 10) / 10} ${units[i]}`;
};

const getExt = (fileName = "") => fileName.split(".").pop()?.toLowerCase() || "";

const getIconForFileType = (fileName = "") => {
    const ext = getExt(fileName);
    switch (ext) {
        case "pdf":
            return <FaFilePdf className="text-4xl text-red-500" />;
        case "doc":
        case "docx":
            return <FaFileWord className="text-4xl text-blue-500" />;
        case "ppt":
        case "pptx":
            return <FaFilePowerpoint className="text-4xl text-orange-500" />;
        case "xls":
        case "xlsx":
            return <FaFileExcel className="text-4xl text-green-500" />;
        case "zip":
        case "rar":
        case "7z":
            return <FaFileArchive className="text-4xl text-yellow-600" />;
        default:
            return <FaFileAlt className="text-4xl text-gray-400" />;
    }
};

// Show a small inline preview for .txt files up to ~100 KB
const canPreviewInlineText = (fileName = "", fileType = "", size = 0) => {
    const ext = getExt(fileName);
    const isTxtType =
        ext === "txt" ||
        fileType?.toLowerCase().startsWith("text/plain");
    return isTxtType && size > 0 && size <= 100 * 1024; // 100 KB
};

const decodeBase64ToText = (base64) => {
    try {
        // atob handles base64 -> binary string; then decodeURIComponent trick for UTF-8
        const binStr = typeof atob !== "undefined" ? atob(base64) : "";
        // Convert binary string to percent-encoded, then decode
        const utf8 = decodeURIComponent(
            binStr
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return utf8;
    } catch {
        // Fallback: try plain atob (may show mojibake for non-ASCII)
        try {
            return typeof atob !== "undefined" ? atob(base64) : "";
        } catch {
            return "";
        }
    }
};

/* =============== Component =============== */

const FileMessageCard = ({
    fileName,
    fileType,
    fileData,     // base64 string (no data: prefix)
    fileSize = 0, // bytes (number)
    timestamp,
    isSent = false,
    delivered = false,
    seen = false,
}) => {
    const fileBlobUrl = useMemo(() => {
        // Expecting raw base64 (without "data:...;base64,")
        // If caller passes full data URL already, just use it.
        const looksLikeDataUrl = typeof fileData === "string" && fileData.startsWith("data:");
        return looksLikeDataUrl
            ? fileData
            : `data:${fileType || "application/octet-stream"};base64,${fileData}`;
    }, [fileData, fileType]);

    const icon = useMemo(() => getIconForFileType(fileName), [fileName]);

    const showTxtPreview = useMemo(
        () => canPreviewInlineText(fileName, fileType, fileSize),
        [fileName, fileType, fileSize]
    );

    const textPreview = useMemo(() => {
        if (!showTxtPreview || !fileData) return "";
        // If full data URL passed, split; else assume raw base64
        const base64 =
            typeof fileData === "string" && fileData.startsWith("data:")
                ? fileData.split(";base64,")[1] || ""
                : fileData;
        const txt = decodeBase64ToText(base64);
        // Limit preview to ~500 chars
        return txt.length > 500 ? `${txt.slice(0, 500)}…` : txt;
    }, [showTxtPreview, fileData]);

    return (
        <div
            className={`w-[30%] p-3 rounded-2xl shadow-md ${isSent ? "bg-green-700 text-white ml-auto" : "bg-gray-700 text-white mr-auto"
                }`}
        >
            {/* Top: Icon + meta */}
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">{icon}</div>

                <div className="flex-1 min-w-0 break-words">
                    <div className="text-sm font-semibold truncate" title={fileName}>
                        {fileName || "Unnamed file"}
                    </div>
                    <div className="text-xs text-white/80">
                        {formatBytes(fileSize)}
                    </div>
                    {fileType && (
                        <div className="text-[11px] text-white/60 mt-0.5">
                            {fileType}
                        </div>
                    )}
                </div>
            </div>

            {/* Optional .txt preview */}
            {showTxtPreview && textPreview && (
                <div className="mt-3 p-2 rounded-md bg-black/20 text-xs whitespace-pre-wrap max-h-40 overflow-auto">
                    {textPreview}
                </div>
            )}

            {/* Download button */}
            <a
                href={fileBlobUrl}
                download={fileName || "download"}
                className="mt-3 inline-block bg-white text-green-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-gray-200 ml-1"
            >
                <div className="flex items-center gap-2">
                    <FaDownload /> Download
                </div>
            </a>

            {/* Timestamp + ticks */}
            <div className="mt-1 flex items-center gap-1 text-[11px] text-white/60 justify-end">
                <span>
                    {timestamp
                        ? new Date(timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                        : "—"}
                </span>

                {isSent && (
                    seen ? (
                        <span className="text-blue-400">✓✓</span>
                    ) : delivered ? (
                        <span className="text-white">✓✓</span>
                    ) : (
                        <span className="text-white">✓</span>
                    )
                )}
            </div>
        </div>
    );
};

export default FileMessageCard;