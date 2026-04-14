// Supabase Edge Function: ACRCloud copyright check on uploaded audio.
// If the file is identified as a known commercial track, deletes it from storage
// and returns { copyrighted: true } so the client can alert the user.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "jsr:@supabase/supabase-js@2/cors";

const ACR_MAX_SAMPLE_BYTES = 1_000_000; // 1MB – ACRCloud recommends < 1M, ~15 sec

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function identifyWithACRCloud(audioBlob: Blob): Promise<{
  copyrighted: boolean;
  reason?: string;
}> {
  const host = Deno.env.get("ACR_CLOUD_HOST");
  const accessKey = Deno.env.get("ACR_CLOUD_ACCESS_KEY");
  const accessSecret = Deno.env.get("ACR_CLOUD_ACCESS_SECRET");

  if (!host || !accessKey || !accessSecret) {
    console.warn("ACRCloud credentials not set – skipping identification");
    return { copyrighted: false };
  }

  // Use first 1MB of audio (ACRCloud recommends < 1MB, ~15 sec)
  const fullSize = audioBlob.size;
  const sampleSize = Math.min(fullSize, ACR_MAX_SAMPLE_BYTES);
  const sample =
    fullSize <= ACR_MAX_SAMPLE_BYTES
      ? audioBlob
      : audioBlob.slice(0, sampleSize);

  const httpMethod = "POST";
  const httpUri = "/v1/identify";
  const dataType = "audio";
  const signatureVersion = "1";
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const stringToSign =
    `${httpMethod}\n${httpUri}\n${accessKey}\n${dataType}\n${signatureVersion}\n${timestamp}`;
  const signature = await hmacSha1Base64(accessSecret, stringToSign);

  const form = new FormData();
  form.append("sample", sample, "sample.mp3");
  form.append("access_key", accessKey);
  form.append("sample_bytes", sampleSize.toString());
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("data_type", dataType);
  form.append("signature_version", signatureVersion);

  const url = `https://${host}/v1/identify`;
  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    console.error("ACRCloud API error:", res.status, await res.text());
    return { copyrighted: false };
  }

  const json = (await res.json()) as {
    status?: { code?: number; msg?: string };
    metadata?: { music?: Array<{ title?: string; artists?: Array<{ name?: string }>; score?: number }> };
  };

  const code = json.status?.code ?? -1;
  const music = json.metadata?.music;

  if (code !== 0 || !music || music.length === 0) {
    return { copyrighted: false };
  }

  // Score 70–100 = match (per ACRCloud docs). Use 80 to reduce false positives.
  const best = music[0];
  const score = best.score ?? 0;
  if (score < 80) {
    return { copyrighted: false };
  }

  const artistName = best.artists?.[0]?.name ?? "Unknown";
  const title = best.title ?? "Unknown";
  return {
    copyrighted: true,
    reason: `This audio matches a known recording: "${title}" by ${artistName}. It has been removed from storage.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const { data: { user: authUser } } = await supabase.auth.getUser(token);
    if (authUser?.id) {
      const { data: profile } = await supabase
        .from("users")
        .select("is_verified_artist")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profile?.is_verified_artist === true) {
        return new Response(
          JSON.stringify({ copyrighted: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    const body = (await req.json()) as { bucket?: string; path?: string };
    const bucket = body.bucket ?? "music-files";
    const path = body.path;

    if (!path || typeof path !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing storage path" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileBlob) {
      console.error("Storage download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Could not download file from storage" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const result = await identifyWithACRCloud(fileBlob);

    if (result.copyrighted) {
      const { error: deleteError } = await supabase.storage.from(bucket).remove([path]);
      if (deleteError) {
        console.error("Storage delete error:", deleteError);
      }
      return new Response(
        JSON.stringify({
          copyrighted: true,
          reason: result.reason,
          deleted: !deleteError,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ copyrighted: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("check-copyright-acr error:", err);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
