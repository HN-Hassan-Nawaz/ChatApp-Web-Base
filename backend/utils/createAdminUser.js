import User from '../models/User.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

export const createAdminUser = async () => {
    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });

    if (existingAdmin) {
        console.log("⚠️ Admin already exists.");
        return;
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    const admin = new User({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
        role: process.env.ADMIN_ROLE,
        gender: process.env.ADMIN_GENDER
    });

    await admin.save();
    console.log("✅ Admin user created successfully.");
};