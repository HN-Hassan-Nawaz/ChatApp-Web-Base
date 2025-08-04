import User from '../models/User.js';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const generateToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

export const createUser = async (req, res) => {
  const { name, email, password, gender } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      gender,
    });

    await newUser.save();

    // Generate JWT Token
    const token = generateToken(newUser._id, newUser.email, newUser.role);

    // Send email (optional)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Admin 👨‍💼" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your Login Credentials',
      text: `Hello ${name},\n\nYour account has been created.\n\nLogin Email: ${email}\nPassword: ${password}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: 'User created and email sent',
      token, // Send JWT to frontend
      userId: newUser._id,
      role: newUser.role,
      name: newUser.name,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    console.log(`✅ User Logged In: ${user.name} (${user.email}) — Role: ${user.role}`);

    // Generate JWT Token
    const token = generateToken(user._id, user.email, user.role);

    res.status(200).json({
      message: 'Login successful',
      token, // Send JWT to frontend
      userId: user._id,
      role: user.role,
      name: user.name,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Login failed' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get users' });
  }
};

export const getAdmin = async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('-password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin' });
  }
};