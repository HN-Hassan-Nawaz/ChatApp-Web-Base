import mongoose from 'mongoose';
import { createAdminUser } from '../utils/createAdminUser.js';

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB connected");
        await createAdminUser();
    } catch (error) {
        console.error("❌ MongoDB error:", error.message);
        process.exit(1);
    }
};

export default connectDB;