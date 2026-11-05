// Cloudflare Pages middleware: the old *.pages.dev address permanently redirects to the custom domain,
// keeping path, query string and hash-less URL intact (for example /purchase.html?hwid=...).
// Preview deployments (<hash>.esp32canbus.pages.dev) have a different hostname and are not touched,
// and candecoder.app itself is never redirected, so there is no loop.
const OLD_HOST = "esp32canbus.pages.dev";
const NEW_ORIGIN = "https://candecoder.app";

export async function onRequest(context) {
    const url = new URL(context.request.url);
    if (url.hostname === OLD_HOST) {
        return Response.redirect(NEW_ORIGIN + url.pathname + url.search, 301);
    }
    return context.next();
}
