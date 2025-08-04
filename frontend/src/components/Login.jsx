import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useEffect } from 'react';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/users/login', formData);
            setMessage(res.data.message);

            navigate('/home', {
                state: {
                    role: res.data.role,
                    userName: res.data.name,
                    userId: res.data.userId,
                },
            });

            console.log("Logged in user from login form:", { name: userName, role, userId });

            // Store JWT and user data in localStorage
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('userId', res.data.userId);
            localStorage.setItem('role', res.data.role);
            localStorage.setItem('userName', res.data.name);

            // Redirect based on role
            // window.location.href = '/home';

        } catch (error) {
            const errMsg = error.response?.data?.message || 'Login failed';
            setMessage(errMsg);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 p-6 bg-white shadow-md rounded">
            <h2 className="text-2xl font-bold mb-4">Login</h2>

            {message && <p className="mb-4 text-red-600">{message}</p>}

            <label className="block mb-2 text-sm font-medium">Email</label>
            <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 mb-4 border border-gray-300 rounded"
                required
            />

            <label className="block mb-2 text-sm font-medium">Password</label>
            <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 mb-6 border border-gray-300 rounded"
                required
            />

            <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
                Login
            </button>
        </form>
    );
};

export default Login;