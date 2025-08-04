import express from 'express';
import { createUser, loginUser, getAllUsers, getAdmin } from '../controllers/UserControllers.js';


const router = express.Router();

router.post('/signup', createUser);
router.post('/login', loginUser);
router.get('/all', getAllUsers);
router.get('/admin', getAdmin);

export default router;