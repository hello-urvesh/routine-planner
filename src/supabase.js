import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://afytbwddbabxrnrpusrj.supabase.co"
const supabaseKey = "sb_publishable_jseXJdWKkIn5EmbIzZoNdw_qw1hv3NV"

export const supabase = createClient(supabaseUrl, supabaseKey)