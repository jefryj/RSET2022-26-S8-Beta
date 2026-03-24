import { createClient } from '@supabase/supabase-js';
//const supabaseUrl = 'https://yikeoqupcxxfjeenjroq.supabase.c';
const supabaseUrl = 'https://vwufqktcazcosfsocsvq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3dWZxa3RjYXpjb3Nmc29jc3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTAyOTEsImV4cCI6MjA4NTgyNjI5MX0.5McdihzNn8cL5KmiHMChJ3pdkWd_BAXhyrUMccUQTxA';

export const supabase = createClient(supabaseUrl, supabaseKey);
