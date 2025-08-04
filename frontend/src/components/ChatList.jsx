import React from 'react';

const chats = [
    { name: 'Ali Ahmad', message: 'https://www.facebook.com/...', time: 'Yesterday', count: 0 },
    { name: 'Italian_PhD...', message: '~Muhammad Rafi Rajput...', time: '2:44 AM', count: 37 },
    { name: 'Romania 🇷🇴...', message: '~Muhammad Zulfiqar...', time: '2:29 AM', count: 361 },
    { name: 'Queries/Open...', message: '~Ali: Did anyone renew...', time: '2:12 AM', count: 100 },
];

const ChatList = () => {
    return (
        <div className="flex-1 overflow-y-auto">
            {chats.map((chat, index) => (
                <div key={index} className="flex justify-between items-center px-3 py-2 hover:bg-gray-700 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-500" />
                        <div>
                            <div className="text-white font-semibold text-sm">{chat.name}</div>
                            <div className="text-gray-400 text-xs">{chat.message}</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        <span className="text-xs text-green-400">{chat.time}</span>
                        {chat.count > 0 && (
                            <span className="text-xs bg-green-500 text-white rounded-full px-2 mt-1">
                                {chat.count}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ChatList;