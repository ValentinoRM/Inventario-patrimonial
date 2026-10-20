import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listUsers(adminClient: ReturnType<typeof createClient>) {
  const users: User[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Método no permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: "Falta configurar la función segura de administración." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond({ error: "Se requiere una sesión autenticada." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return respond({ error: "La sesión no es válida." }, 401);
  if (authData.user.app_metadata?.role !== "admin") {
    return respond({ error: "Solo un administrador puede gestionar usuarios." }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let body: Record<string, unknown>;
  try {
    const parsedBody: unknown = await request.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return respond({ error: "El cuerpo debe ser un objeto JSON." }, 400);
    }
    body = parsedBody as Record<string, unknown>;
  } catch {
    return respond({ error: "El cuerpo de la solicitud no es JSON válido." }, 400);
  }

  if (body.action === "list") {
    try {
      const users = await listUsers(adminClient);
      return respond({
        users: users.map(user => ({
          id: user.id,
          email: user.email ?? "",
          role: user.app_metadata?.role === "admin" ? "admin" : "user",
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return respond({ error: `No se pudieron listar los usuarios: ${message}` }, 500);
    }
  }

  if (body.action === "set_role") {
    const userId = body.userId;
    if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return respond({ error: "El identificador de usuario no es válido." }, 400);
    }
    const role = body.role;
    if (role !== "admin" && role !== "user") {
      return respond({ error: "El rol debe ser Administrador o Usuario." }, 400);
    }
    if (userId === authData.user.id) {
      return respond({ error: "No puedes cambiar tu propio rol desde esta sesión." }, 400);
    }

    const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetData.user) {
      return respond({ error: `No se encontró el usuario: ${targetError?.message ?? "usuario inexistente"}` }, 404);
    }
    const appMetadata = { ...targetData.user.app_metadata, role };
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
    });
    if (updateError) return respond({ error: `No se pudo actualizar el rol: ${updateError.message}` }, 500);
    return respond({ success: true });
  }

  return respond({ error: "Acción no válida." }, 400);
});
