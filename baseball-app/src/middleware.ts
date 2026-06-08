import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { resolveUserRole } from "@/lib/auth/profile";
import { isPathAllowedForRole, resolvePostLoginPath, type AppRole } from "@/lib/auth/roles";

/** When false, anyone can use the app without signing in (default). Set AUTH_REQUIRED=true to enforce login. */
function isAuthEnforced(): boolean {
  if (process.env.AUTH_DISABLED === "true") return false;
  return process.env.AUTH_REQUIRED === "true";
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/callback")) return true;
  if (pathname.startsWith("/auth/signout")) return true;
  if (pathname === "/manifest.webmanifest" || pathname === "/manifest.json") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!isAuthEnforced()) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !isEmailAllowed(user.email ?? undefined)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
  }

  if (!user && !isPublicPath(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  let role: AppRole | null = null;
  if (user) {
    role = await resolveUserRole(supabase, user);
  }

  if (user && !role && pathname !== "/forbidden" && !isPublicPath(pathname)) {
    const denied = new URL("/forbidden", request.url);
    denied.searchParams.set("error", "no_role");
    return NextResponse.redirect(denied);
  }

  if (user && role && pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const destination = resolvePostLoginPath(next, role);
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (user && role === "coach" && pathname === "/") {
    return NextResponse.redirect(new URL("/coach", request.url));
  }

  if (user && role && !isPathAllowedForRole(pathname, role) && pathname !== "/forbidden") {
    const denied = new URL("/forbidden", request.url);
    denied.searchParams.set("error", "role");
    denied.searchParams.set("from", pathname);
    return NextResponse.redirect(denied);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all pathnames except static assets and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
