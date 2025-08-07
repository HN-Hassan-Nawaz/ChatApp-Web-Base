import {
    FaFilePdf,
    FaFileWord,
    FaFilePowerpoint,
    FaFileExcel,
    FaFileAlt,
    FaFileArchive,
    FaDownload,
} from "react-icons/fa";

const getIconForFileType = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
        case 'pdf': return <FaFilePdf className="text-4xl text-red-500" />;
        case 'doc':
        case 'docx': return <FaFileWord className="text-4xl text-blue-500" />;
        case 'ppt':
        case 'pptx': return <FaFilePowerpoint className="text-4xl text-orange-500" />;
        case 'xls':
        case 'xlsx': return <FaFileExcel className="text-4xl text-green-500" />;
        case 'zip':
        case 'rar': return <FaFileArchive className="text-4xl text-yellow-600" />;
        default: return <FaFileAlt className="text-4xl text-gray-400" />;
    }
};

const FileMessageCard = ({ fileName, fileType, fileData, fileSize, timestamp, isSent, delivered, seen }) => {
    const fileBlobUrl = `data:${fileType};base64,${fileData}`;
    const icon = getIconForFileType(fileName);

    return (
        <div
            className={`w-[30%] p-3 rounded-2xl shadow-md ${isSent ? 'bg-green-700 text-white ml-auto' : 'bg-gray-700 text-white mr-auto'}`}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">{icon}</div>

                {/* File Info */}
                <div className="flex-1 break-all">
                    <div className="text-sm font-semibold">{fileName}</div>
                    <div className="text-xs text-white/80">{Math.round(fileSize / 1024)} KB</div>
                </div>
            </div>

            {/* Download Button */}
            <a
                href={fileBlobUrl}
                download={fileName}
                className="mt-3 inline-block bg-white text-green-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-gray-200 ml-1"
            >
                <div className="flex items-center gap-3">
                    <FaDownload /> Download
                </div>
            </a>

            {/* Timestamp + Tick */}
            <div className={`mt-1 flex items-center gap-1 text-[11px] text-white/60 justify-end`}>
                <span>
                    {new Date(timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
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