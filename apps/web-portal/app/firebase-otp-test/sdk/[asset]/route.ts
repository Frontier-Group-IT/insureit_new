const firebaseSdkAssets = {
  "firebase-app-compat.js": "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "firebase-auth-compat.js": "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
} as const;

type FirebaseSdkAsset = keyof typeof firebaseSdkAssets;

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> },
) {
  const { asset } = await context.params;
  if (!(asset in firebaseSdkAssets)) {
    return new Response("Not found", { status: 404 });
  }

  const upstreamUrl = firebaseSdkAssets[asset as FirebaseSdkAsset];

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "application/javascript,text/javascript,*/*;q=0.1" },
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return new Response("Firebase SDK upstream unavailable", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const source = await upstream.text();
    return new Response(source, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Firebase SDK upstream unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
