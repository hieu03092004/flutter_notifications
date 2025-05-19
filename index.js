import express from 'express';
import "dotenv/config";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import fs from 'fs';
import supabase from './config/database.js';
import moment from 'moment';


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
//ham de lay ngay
const port = process.env.PORT || 3000;
function getDateRange(filter) {
  const tzNow = moment(); // theo timezone server
  const startOfDay = tzNow.clone().startOf('day');
  switch (filter) {
    case 'today':
      return {
        gte: startOfDay.toISOString(),
        lt: startOfDay.add(1, 'day').toISOString()
      };
    case 'yesterday':
      const yesterday = startOfDay.clone().subtract(1, 'day');
      return {
        gte: yesterday.toISOString(),
        lt: yesterday.clone().add(1, 'day').toISOString()
      };
    case 'all':
    default:
      return null;
  }
}
// 1) GET /notifications?recipient_id=…&filter=today|yesterday|all
app.get('/notifications', async (req, res) => {
  const { recipient_id, filter = 'all' } = req.query;
  if (!recipient_id) {
    return res.status(400).json({ error: 'recipient_id is required' });
  }

  let query = supabase
    .from('notification')
    .select('*')
    .eq('recipient_id', recipient_id)
    .order('created_at', { ascending: false })

  const range = getDateRange(filter);
  if (range) {
    query = query
      .gte('created_at', range.gte)
      .lt('created_at', range.lt);
  }

  const { data, error } = await query;
  console.log(`Filter:${filter}`)
  //console.log(`Dara filter Notificatons:${data}`)
  for(let i=0;i<data.length;i++)
      console.log(`Data ${i}:`, data[i]);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
// 2) GET /notifications/unread_count?recipient_id=…
app.get('/notifications/unread_count', async (req, res) => {
  const { recipient_id } = req.query;
  if (!recipient_id) {
    return res.status(400).json({ error: 'recipient_id is required' });
  }

  const { count, error } = await supabase
    .from('notification')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', recipient_id)
    .eq('is_read', false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ unread_count: count });
});
// 3) POST /notifications/mark_read_by_filter
//    Body: { recipient_id, filter: 'today'|'yesterday'|'all' }
app.post('/notifications/mark_read_by_filter', async (req, res) => {
  const { recipient_id, filter = 'all' } = req.body;
  if (!recipient_id) {
    return res.status(400).json({ error: 'recipient_id is required' });
  }

  let updatePayload = supabase
    .from('notification')
    .update({ is_read: true })
    .select('notification_id')
    .eq('recipient_id', recipient_id);

  const range = getDateRange(filter);
  if (range) {
    updatePayload = updatePayload
      .gte('created_at', range.gte)
      .lt('created_at', range.lt);
  }

  const { data, error } = await updatePayload;
  console.log(`Data:`,data)

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, updated: data.length });
});
app.listen(port, () => console.log(`🚀 Notification API listening on port ${port}`));

