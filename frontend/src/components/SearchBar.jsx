import React from 'react';

const SearchBar = () => {
    return (
        <div className="px-3 py-2">
            <input
                type="text"
                placeholder="Search or start a new chat"
                className="w-full px-3 py-1 rounded bg-gray-800 text-white placeholder-gray-400"
            />
        </div>
    );
};

export default SearchBar;