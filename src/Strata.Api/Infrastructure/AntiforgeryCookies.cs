using Microsoft.AspNetCore.Antiforgery;

namespace Strata.Api.Infrastructure;

public static class AntiforgeryCookies
{
    /// <summary>Readable (non-HttpOnly) cookie holding the request token for the SPA to echo back.</summary>
    public const string RequestTokenCookie = "XSRF-TOKEN";
    public const string HeaderName = "X-XSRF-TOKEN";

    /// <summary>
    /// Issues a fresh token pair for the current <see cref="HttpContext.User"/>. Tokens are bound to
    /// the user identity, so this must be called again after sign-in and sign-out.
    /// </summary>
    public static void Issue(IAntiforgery antiforgery, HttpContext context)
    {
        var tokens = antiforgery.GetAndStoreTokens(context);
        context.Response.Cookies.Append(RequestTokenCookie, tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            SameSite = SameSiteMode.Strict,
            Secure = context.Request.IsHttps,
            Path = "/",
        });
    }
}
