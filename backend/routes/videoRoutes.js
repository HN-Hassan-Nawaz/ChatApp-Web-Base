import express from 'express';
import { videochanks } from '../controllers/VideoController.js';


const router = express.Router();

router.post('/upload-chunk', videochanks);

export default router;