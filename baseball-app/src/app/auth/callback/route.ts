import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveUserRole } from "@/lib/auth/profile";
import { resolvePostLoginPath } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!url || !key) {
    return NextResponse.redirect(new URL("/login?error=config", origin));
  }

  if (code) {
    const response = NextResponse.redirect(new URL(next, origin));
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const role = await resolveUserRole(supabase, user);
        if (role) {
          const destination = resolvePostLoginPath(next, role);
          return NextResponse.redirect(new URL(destination, origin));
        }
        return NextResponse.redirect(new URL("/forbidden?error=no_role", origin));
      }
      return response;
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
