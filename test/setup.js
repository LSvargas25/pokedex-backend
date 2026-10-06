// Valores falsos para que el cliente de Supabase se pueda crear sin .env.
// Apunta a un puerto cerrado: cualquier llamada real falla rápido en vez de salir a internet.
process.env.SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
