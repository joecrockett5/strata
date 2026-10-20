using Strata.Domain.Content;

namespace Strata.Rendering;

/// <summary>Navigation and page links from the pages panel. Mirrors nav.ts in @strata/renderer.</summary>
public static class Navigation
{
    public static SiteInfo BuildSiteInfo(SiteDocument document, Guid currentPageId, Func<string, string> hrefFor) => new()
    {
        FirmName = document.Settings.FirmName,
        Logo = document.Settings.Logo,
        HomeHref = hrefFor(string.Empty),
        Nav = [.. document.Pages.Where(p => p.ShowInNav).Select(p => new NavLink(p.Id, p.Title, hrefFor(p.Slug), p.Id == currentPageId))],
    };

    public static IReadOnlyDictionary<Guid, string> PageHrefs(SiteDocument document, Func<string, string> hrefFor) =>
        document.Pages.ToDictionary(p => p.Id, p => hrefFor(p.Slug));
}

/// <summary>Metadata for the document head of a public page.</summary>
public sealed record PageHead
{
    public required string Title { get; init; }
    public required string Description { get; init; }
    public required string CanonicalUrl { get; init; }
    public required string SiteName { get; init; }
    public string? ImageUrl { get; init; }

    /// <summary>Where site.css/site.js are served from, e.g. "/site-assets/".</summary>
    public required string AssetBase { get; init; }
}
