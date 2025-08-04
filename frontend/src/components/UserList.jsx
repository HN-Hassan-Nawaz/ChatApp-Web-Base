// src/components/UserList.jsx
import { useEffect, useState } from 'react';

const UserList = ({ onUserClick, activeUserId, isAdmin, filteredUsers }) => {
    const [signupUsers, setSignupUsers] = useState([]);

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
        } else if (filteredUsers) {
            setSignupUsers(filteredUsers);
        }
    }, [isAdmin, filteredUsers]);

    const fetchUsers = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/users/all');
            const data = await res.json();
            setSignupUsers(data); // Assuming the backend sends an array directly
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto">
            {signupUsers && signupUsers.length === 0 ? (
                <p className="text-center text-gray-500 p-4">No users yet.</p>
            ) : (
                signupUsers?.map((user) => (
                    <div
                        key={user._id}
                        onClick={() => onUserClick(user)}
                        className={`flex items-center p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-100 ${activeUserId === user._id ? 'bg-gray-100' : ''}`}
                    >
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
                            {user.name?.charAt(0)}
                        </div>
                        <div className="ml-3 flex-1">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold">{user.name}</h3>
                                <span className="text-xs text-gray-500">online</span>
                            </div>
                            <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default UserList;