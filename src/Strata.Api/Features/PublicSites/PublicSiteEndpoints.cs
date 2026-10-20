using System.Text;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Net.Http.Headers;
using Strata.Domain.Content;
using Strata.Domain.Sites;
using Strata.Infrastructure.Persistence;
using Strata.Rendering;

namespace Strata.Api.Features.PublicSites;

/// <summary>
/// Published sites, server-rendered from the immutable published snapshot only (never the
/// draft). Path routing <c>/s/{slug}/{page}</c>; host routing is mapped onto it by
/// <see cref="SiteHostRouting"/>.
/// </summary>
public static partial class PublicSiteEndpoints
{
    public const string ContactRateLimitPolicy = "contact";
    private const string AssetBase = "/site-assets/";

    private sealed record LiveSite(Guid SiteId, string Slug, Guid VersionId, PublishedSnapshot Snapshot);

    public static IEndpointRouteBuilder MapPublicSiteEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/s/{siteSlug}").WithTags("Public sites").AllowAnonymous().ExcludeFromDescription();
        group.MapGet("/robots.txt", RobotsAsync);
        group.MapGet("/sitemap.xml", SitemapAsync);
        group.MapPost("/_contact", ContactAsync).DisableAntiforgery().RequireRateLimiting(ContactRateLimitPolicy);
        group.MapGet("/{**pagePath}", PageAsync);
        return routes;
    }

    private static async Task<LiveSite?> LoadAsync(string slug, StrataDbContext db, IMemoryCache cache, CancellationToken cancellationToken)
    {
        var normalized = slug.ToLowerInvariant();
        var row = await db.Sites.AsNoTracking()
            .Where(s => s.Slug == normalized && s.CurrentPublishedVersionId != null)
            .Select(s => new { s.Id, s.Slug, VersionId = s.CurrentPublishedVersionId!.Value })
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null)
        {
            return null;
        }

        // Published versions are immutable, so a snapshot can be cached by its id indefinitely.
        var snapshot = await cache.GetOrCreateAsync(("published-site-version", row.VersionId), async entry =>
        {
            entry.SlidingExpiration = TimeSpan.FromMinutes(10);
            return (await db.PublishedSiteVersions.AsNoTracking().SingleAsync(v => v.Id == row.VersionId, cancellationToken)).Snapshot;
        });
        return new LiveSite(row.Id, row.Slug, row.VersionId, snapshot!);
    }

    private static Func<string, string> HrefFor(HttpContext context, string slug)
    {
        var publicBase = SiteHostRouting.PublicBase(context, slug);
        return pageSlug => pageSlug.Length == 0 ? $"{publicBase}/" : $"{publicBase}/{pageSlug}";
    }

    private static string Origin(HttpRequest request) => $"{request.Scheme}://{request.Host}";

    private static async Task<IResult> PageAsync(
        string siteSlug, string? pagePath, HttpContext context, StrataDbContext db, IMemoryCache cache, StrataRenderer renderer, CancellationToken cancellationToken)
    {
        var site = await LoadAsync(siteSlug, db, cache, cancellationToken);
        var path = (pagePath ?? string.Empty).Trim('/').ToLowerInvariant();
        var page = site?.Snapshot.Document.Pages.FirstOrDefault(p => p.Slug == path);
        if (site is null || page is null)
        {
            return await NotFoundAsync(context, site, renderer);
        }

        ContactFormState? state = Guid.TryParse(context.Request.Query["sent"], out var sent) ? new ContactFormState(sent, ContactFormStatus.Success) : null;
        var etag = new EntityTagHeaderValue($"\"{site.VersionId:N}.{page.Id:N}{(state is null ? string.Empty : $".{sent:N}")}\"");
        context.Response.GetTypedHeaders().ETag = etag;
        context.Response.Headers.CacheControl = "public, no-cache";
        if (context.Request.GetTypedHeaders().IfNoneMatch.Any(tag => tag.Compare(etag, useStrongComparison: true) || tag.Equals(EntityTagHeaderValue.Any)))
        {
            return Results.StatusCode(StatusCodes.Status304NotModified);
        }

        return await RenderAsync(context, site, page, state, StatusCodes.Status200OK, renderer);
    }

    private static async Task<IResult> RenderAsync(HttpContext context, LiveSite site, Page page, ContactFormState? state, int status, StrataRenderer renderer)
    {
        var document = site.Snapshot.Document;
        var hrefFor = HrefFor(context, site.Slug);
        var origin = Origin(context.Request);
        var firm = document.Settings.FirmName;
        var head = new PageHead
        {
            Title = !string.IsNullOrWhiteSpace(page.Seo.Title) ? page.Seo.Title : page.IsHome ? firm : $"{page.Title} · {firm}",
            Description = page.Seo.Description,
            CanonicalUrl = origin + hrefFor(page.Slug),
            SiteName = firm,
            ImageUrl = document.Settings.Logo?.MediaId is { } logo ? $"{origin}/media/{logo}" : null,
            AssetBase = AssetBase,
        };
        var renderContext = new RenderContext
        {
            Site = Navigation.BuildSiteInfo(document, page.Id, hrefFor),
            PageHrefs = Navigation.PageHrefs(document, hrefFor),
            MediaBase = "/media/",
            FormAction = $"{SiteHostRouting.PublicBase(context, site.Slug)}/_contact",
            PageId = page.Id,
            FormState = state,
        };

        ApplySecurityHeaders(context.Response);
        var html = await renderer.RenderPublicPageAsync(head, document, page.Id, site.Snapshot.Definitions, renderContext);
        return Results.Content(html, "text/html; charset=utf-8", Encoding.UTF8, status);
    }

    private static async Task<IResult> NotFoundAsync(HttpContext context, LiveSite? site, StrataRenderer renderer)
    {
        ApplySecurityHeaders(context.Response);
        context.Response.Headers.CacheControl = "no-store";
        var html = await renderer.RenderNotFoundAsync(
            site?.Snapshot.Document.Theme ?? Theme.Default,
            site?.Snapshot.Document.Settings.FirmName,
            site is null ? null : HrefFor(context, site.Slug)(string.Empty),
            AssetBase);
        return Results.Content(html, "text/html; charset=utf-8", Encoding.UTF8, StatusCodes.Status404NotFound);
    }

    /// <summary>Published pages load only same-origin resources; theme tokens use inline style attributes.</summary>
    private static void ApplySecurityHeaders(HttpResponse response)
    {
        response.Headers.ContentSecurityPolicy =
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'";
        response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    }

    private static async Task<IResult> RobotsAsync(string siteSlug, HttpContext context, StrataDbContext db, IMemoryCache cache, CancellationToken cancellationToken)
    {
        var site = await LoadAsync(siteSlug, db, cache, cancellationToken);
        if (site is null)
        {
            return Results.NotFound();
        }

        var sitemap = Origin(context.Request) + SiteHostRouting.PublicBase(context, site.Slug) + "/sitemap.xml";
        return Results.Text($"User-agent: *\nAllow: /\nSitemap: {sitemap}\n", "text/plain; charset=utf-8");
    }

    private static async Task<IResult> SitemapAsync(string siteSlug, HttpContext context, StrataDbContext db, IMemoryCache cache, CancellationToken cancellationToken)
    {
        var site = await LoadAsync(siteSlug, db, cache, cancellationToken);
        if (site is null)
        {
            return Results.NotFound();
        }

        XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
        var origin = Origin(context.Request);
        var hrefFor = HrefFor(context, site.Slug);
        var xml = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement(ns + "urlset", site.Snapshot.Document.Pages.Select(p => new XElement(ns + "url", new XElement(ns + "loc", origin + hrefFor(p.Slug))))));
        return Results.Text(xml.Declaration + "\n" + xml.Root, "application/xml; charset=utf-8");
    }

    /// <summary>
    /// Contact form post (no JavaScript needed). Valid submissions are stored and redirected
    /// (post/redirect/get) to the page with a success message; invalid ones re-render the page with
    /// errors. The honeypot silently drops bots. Personal data is never logged.
    /// </summary>
    private static async Task<IResult> ContactAsync(
        string siteSlug, HttpContext context, StrataDbContext db, IMemoryCache cache, StrataRenderer renderer, TimeProvider clock, ILoggerFactory loggers, CancellationToken cancellationToken)
    {
        var site = await LoadAsync(siteSlug, db, cache, cancellationToken);
        if (site is null || !context.Request.HasFormContentType)
        {
            return Results.NotFound();
        }

        var form = await context.Request.ReadFormAsync(cancellationToken);
        var document = site.Snapshot.Document;
        var page = Guid.TryParse(form["pageId"], out var pageId) ? document.Pages.FirstOrDefault(p => p.Id == pageId) : null;
        var section = page is not null && Guid.TryParse(form["sectionId"], out var sectionId)
            ? new[] { document.Header, document.Footer }.Concat(page.Sections).OfType<SectionInstance>().FirstOrDefault(s => s.Id == sectionId && !s.Hidden)
            : null;
        var hasForm = section is not null
            && site.Snapshot.Definitions.TryGetValue(section.VersionRef.ToString(), out var definition)
            && DefinitionWalker.Walk(definition).Any(w => w.Node is ContactFormNode);
        if (page is null || section is null || !hasForm)
        {
            return Results.BadRequest();
        }

        var success = $"{HrefFor(context, site.Slug)(page.Slug)}?sent={section.Id}#section-{section.Id}";
        // Bots that fill the honeypot get the same response as a real success, but nothing is stored.
        if (form[ContactForm.HoneypotField].ToString().Length > 0)
        {
            return SeeOther(context, success);
        }

        var (submission, values, errors) = ContactForm.Validate(form);
        if (submission is null)
        {
            context.Response.Headers.CacheControl = "no-store";
            var state = new ContactFormState(section.Id, ContactFormStatus.Invalid, values, errors);
            return await RenderAsync(context, site, page, state, StatusCodes.Status422UnprocessableEntity, renderer);
        }

        db.ContactSubmissions.Add(ContactSubmission.Create(
            site.SiteId, site.VersionId, page.Id, section.Id, submission.Name, submission.Email, submission.Phone, submission.Message, clock.GetUtcNow()));
        await db.SaveChangesAsync(cancellationToken);
        var logger = loggers.CreateLogger(typeof(PublicSiteEndpoints));
        LogSubmissionStored(logger, site.SiteId);

        return SeeOther(context, success);
    }

    /// <summary>303 after a POST, so refreshing the page does not resend the form.</summary>
    private static IResult SeeOther(HttpContext context, string location)
    {
        context.Response.Headers.Location = location;
        return Results.StatusCode(StatusCodes.Status303SeeOther);
    }

    // Logs the site only: never the visitor's name, email, phone or message.
    [LoggerMessage(Level = LogLevel.Information, Message = "Stored a contact submission for site {SiteId}")]
    private static partial void LogSubmissionStored(ILogger logger, Guid siteId);
}
