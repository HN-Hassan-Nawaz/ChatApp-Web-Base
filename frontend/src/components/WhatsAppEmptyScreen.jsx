// WhatsAppEmptyScreen.jsx
import { BsWhatsapp, BsLockFill } from 'react-icons/bs';

const WhatsAppEmptyScreen = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-[#111b21] text-white">
            <BsWhatsapp className="text-[90px] text-gray-500 mb-6" />

            <h2 className="text-2xl font-semibold">WhatsApp for Windows</h2>

            <p className="text-gray-400 mt-2 text-sm text-center px-4 max-w-md">
                Send and receive messages without keeping your phone online.<br />
                Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
            </p>

            <div className="absolute bottom-4 flex items-center text-gray-500 text-xs">
                <BsLockFill className="mr-1 text-sm" />
                End-to-end encrypted
            </div>
        </div>
    );
};

export default WhatsAppEmptyScreen;