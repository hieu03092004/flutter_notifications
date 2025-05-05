import express from 'express';
import "dotenv/config";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Khởi tạo Express
const app = express();
app.use(express.json());

// Đọc service account từ biến môi trường thay vì file
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Khi chạy trên production (Vercel), đọc từ biến môi trường
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Khi phát triển local, đọc từ file
  const keyPath = path.join(__dirname, 'service-account.json');
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
}

// Khởi tạo GoogleAuth với service account đã đọc
const auth = new GoogleAuth({
  credentials: serviceAccount,
  scopes: 'https://www.googleapis.com/auth/firebase.messaging',
});

// Send FCM via HTTP v1
async function sendFCM(deviceToken, title, body) {
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const message = { message: {
    token: deviceToken,
    notification: { title, body }
  }};

  const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  const res = await axios.post(url, message, {
    headers: {
      'Authorization': `Bearer ${accessToken.token || accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return res.data;
}

// API endpoint
app.post('/send', async (req, res) => {
  try {
    const { deviceToken, title, body } = req.body;
    if (!deviceToken || !title || !body) {
      return res.status(400).json({ error: 'deviceToken, title and body are required' });
    }
    const result = await sendFCM(deviceToken, title, body);
    console.log(`result:${result}`);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Notification API listening on port ${port}`));