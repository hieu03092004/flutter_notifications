import { createClient } from '@supabase/supabase-js';
// Đọc từ biến môi trường
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default supabase;