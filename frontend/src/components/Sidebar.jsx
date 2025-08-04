import { useState } from 'react';
import Signup from './Signup';
import UserList from './UserList';

const WhatsAppClone = () => {
    const [activeUserId, setActiveUserId] = useState(null);
    const [isSignupOpen, setIsSignupOpen] = useState(false);

    const handleSignupClose = () => {
        setIsSignupOpen(false);
    };

    return (
        <div className="flex h-screen bg-gray-100 w-full">
            {isSignupOpen && <Signup onClose={() => handleSignupClose()} />}

            {/* Left Sidebar */}
            <div className="w-[400px] border-r border-gray-300 bg-white flex flex-col">
                {/* Header */}
                <div className="p-3 bg-gray-100">
                    <h1 className="text-xl font-semibold">WhatsApp</h1>
                </div>

                {/* Search */}
                <div className="p-2 bg-gray-100">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search or start a new chat"
                            className="w-full p-2 pl-10 rounded-lg bg-white border border-gray-300 focus:outline-none focus:border-green-500"
                        />
                        <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Add User Button */}
                <div className="p-2 bg-gray-100 flex justify-end">
                    <button
                        onClick={() => setIsSignupOpen(true)}
                        className="px-3 py-1 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 transition"
                    >
                        ADD USER
                    </button>
                </div>

                {/* 👇 Inject dynamic user list here */}
                <UserList onUserClick={setActiveUserId} activeUserId={activeUserId} />
            </div>

            {/* Right section remains same */}
            <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="mt-2 text-lg font-medium text-gray-900">Select a chat to start messaging</h3>
                    <p className="mt-1 text-gray-500">Choose from your signed-up users</p>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppClone;
