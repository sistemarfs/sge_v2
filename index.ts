// supabase/functions/login/index.ts
//
// v30 — Função de login que emite um JWT real.
//
// POR QUE ISSO EXISTE:
// Hoje o app faz a checagem de usuário/senha DIRETO no navegador, lendo
// a tabela `usuarios` com a anon key (SB.from('usuarios').select('*').eq(...))
// — ou seja, qualquer visitante com a anon key (que está exposta no HTML)
// conseguia também fazer `select *` na tabela usuarios por fora da tela,
// e via ver pass_hash, whatsapp_apikey etc. de todo mundo. Com RLS ligado
// (v29) isso já fica bloqueado para anon, mas ainda falta algo: o app
// precisa de um jeito de PROVAR, depois do login, de qual empresa é o
// usuário — isso é o papel desta função.
//
// O QUE ELA FAZ:
//   1. recebe { username, password } vindos do formulário de login;
//   2. com a SERVICE_ROLE_KEY (nunca vai pro navegador), busca o usuário
//      na tabela `usuarios` ignorando RLS;
//   3. confere a senha com o MESMO hash simples (hp) que o app já usa —
//      ver observação de segurança no final do arquivo;
//   4. se bater, assina um JWT com os claims que o RLS do v29 espera:
//      { sub: <id do usuário>, role: 'authenticated', empresa_id: <...> }
//   5. devolve { jwt, user } pro app guardar e usar em toda consulta.
//
// COMO PUBLICAR:
//   supabase functions deploy login
//   supabase secrets set SGE_JWT_SECRET="<a MESMA string que está em
//     Project Settings → API → JWT Settings → JWT Secret>"
//
// A SERVICE_ROLE_KEY e a URL do projeto já chegam automaticamente pra
// toda Edge Function do Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY),
// não precisa configurar.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { create as createJWT, getNumericDate } from "jsr:@wcrong/djwt@3"; // ver nota de import abaixo

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("SGE_JWT_SECRET")!;

// MESMA função hp() do app (index.html linha ~1642). Se um dia trocarmos
// para um hash de verdade (recomendado — ver nota final), só muda aqui
// e no cadastro de usuários, não no front.
function hp(p: string): string {
  let h = 0;
  for (let i = 0; i < p.length; i++) {
    h = (h << 5) - h + p.charCodeAt(i);
    h |= 0;
  }
  return h.toString(36);
}

function cors(resp: Response): Response {
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Headers", "content-type, authorization");
  resp.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return resp;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response("ok"));
  if (req.method !== "POST") {
    return cors(new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 }));
  }

  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return cors(new Response(JSON.stringify({ error: "Usuário e senha são obrigatórios." }), { status: 400 }));
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: user, error } = await admin
      .from("usuarios")
      .select("*")
      .eq("username", String(username).trim().toLowerCase())
      .maybeSingle();

    if (error || !user || user.pass_hash !== hp(password)) {
      // Mensagem genérica de propósito — não dizer se foi o usuário ou a senha que errou.
      return cors(new Response(JSON.stringify({ error: "Usuário ou senha incorretos." }), { status: 401 }));
    }

    if (!user.empresa_id) {
      return cors(new Response(JSON.stringify({ error: "Usuário sem empresa vinculada. Avise um administrador." }), { status: 403 }));
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const jwt = await createJWT(
      { alg: "HS256", typ: "JWT" },
      {
        sub: user.id,
        role: "authenticated",
        empresa_id: user.empresa_id,
        username: user.username,
        exp: getNumericDate(60 * 60 * 24 * 7), // 7 dias — depois disso, pede login de novo
      },
      key,
    );

    const { pass_hash, whatsapp_apikey, ...safeUser } = user;

    return cors(new Response(JSON.stringify({ jwt, user: safeUser }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  } catch (e) {
    console.error(e);
    return cors(new Response(JSON.stringify({ error: "Erro interno no login." }), { status: 500 }));
  }
});

// ───────────────────────────────────────────────────────────────────
// NOTA SOBRE O IMPORT DO JWT:
// O exemplo usa "jsr:@wcrong/djwt@3" (lib leve de JWT pra Deno). Se na
// hora de publicar o `supabase functions deploy` reclamar desse pacote
// específico, troque por "https://deno.land/x/djwt@v3.0.2/mod.ts" (mesma
// API, create/getNumericDate) — qualquer uma das duas funciona em Edge
// Functions do Supabase (runtime Deno).
//
// NOTA DE SEGURANÇA (não bloqueia o lançamento, mas vale saber):
// hp() é um hash simples de 32 bits, não um hash de senha de verdade
// (bcrypt/scrypt/argon2) — serve para "não guardar a senha em texto
// puro", mas não resiste a um ataque de força bruta se alguém pegar um
// dump da tabela usuarios. Pra curto prazo/teste com o parceiro, dá pra
// manter como está (a tabela agora está protegida por RLS + só esta
// função enxerga o hash). Pra médio prazo, trocar hp() por bcrypt aqui
// dentro (e re-hashear as senhas existentes no próximo login de cada
// usuário) é uma melhoria de baixo risco que não exige tocar no RLS.
