using Strata.Domain.Sites;

namespace Strata.Api.Features.PublicSites;

/// <summary>
/// Host routing: a request to <c>{slug}.localhost:{port}/about</c> is served as
/// <c>/s/{slug}/about</c>. Links on such a page are root-relative, so the public base path is
/// recorded for the page renderer. Shared files (/media, /site-assets) are served as usual.
/// </summary>
public sealed class SiteHostRouting(RequestDelegate next, IConfiguration configuration)
{
    private const string BaseKey = "strata.publicBase";
    private readonly string suffix = configuration["PublicSites:HostSuffix"] ?? ".localhost";

    public Task InvokeAsync(HttpContext context)
    {
        var host = context.Request.Host.Host;
        if (host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase) && !IsSharedPath(context.Request.Path))
        {
            var slug = host[..^suffix.Length].ToLowerInvariant();
            if (Site.IsValidSlug(slug))
            {
                context.Items[BaseKey] = string.Empty;
                context.Request.Path = new PathString($"/s/{slug}").Add(context.Request.Path == "/" ? PathString.Empty : context.Request.Path);
            }
        }

        return next(context);
    }

    private static bool IsSharedPath(PathString path) =>
        path.StartsWithSegments("/media") || path.StartsWithSegments("/site-assets") || path.StartsWithSegments("/health");

    /// <summary>The path prefix public links use: "" on a site host, "/s/{slug}" otherwise.</summary>
    public static string PublicBase(HttpContext context, string slug) =>
        context.Items.TryGetValue(BaseKey, out var value) && value is string bases ? bases : $"/s/{slug}";
}
