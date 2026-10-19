using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Strata.Api.Features.Content;
using Strata.Api.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Sites;
using Strata.Infrastructure.Persistence;

namespace Strata.Api.Features.Sites;

public static class SiteEndpoints
{
    /// <summary>Slugs that would collide with routes or confuse visitors on {slug}.localhost.</summary>
    private static readonly HashSet<string> ReservedSlugs = ["www", "api", "app", "admin", "media", "assets", "site-assets", "static"];

    public static IEndpointRouteBuilder MapSiteEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/sites")
            .WithTags("Sites")
            .RequireAuthorization(AuthenticationSetup.SiteOwnerPolicy);

        group.MapGet("/", ListAsync).WithName("ListSites");
        group.MapPost("/", CreateAsync).WithName("CreateSite");
        group.MapGet("/{id:guid}", GetAsync).WithName("GetSite");
        group.MapPatch("/{id:guid}", UpdateAsync).WithName("UpdateSite");
        group.MapPut("/{id:guid}/draft", SaveDraftAsync).WithName("SaveSiteDraft");
        group.MapDelete("/{id:guid}", DeleteAsync).WithName("DeleteSite");

        return routes;
    }

    /// <summary>Loads a site only if the caller owns it. Other users' sites are indistinguishable from missing ones.</summary>
    internal static Task<Site?> FindOwnedAsync(this StrataDbContext db, Guid siteId, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var ownerId = user.GetUserId();
        return db.Sites.SingleOrDefaultAsync(s => s.Id == siteId && s.OwnerId == ownerId, cancellationToken);
    }

    private static async Task<Ok<List<SiteSummary>>> ListAsync(StrataDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var ownerId = user.GetUserId();
        var sites = await db.Sites.Where(s => s.OwnerId == ownerId).OrderByDescending(s => s.UpdatedAt).ToListAsync(cancellationToken);
        return TypedResults.Ok(sites.Select(SiteSummary.From).ToList());
    }

    private static async Task<Results<Created<SiteDetail>, ProblemHttpResult>> CreateAsync(
        CreateSiteRequest request,
        StrataDbContext db,
        ContentWritePipeline pipeline,
        TimeProvider clock,
        ClaimsPrincipal user,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        var slug = request.Slug.Trim().ToLowerInvariant();
        if (SlugProblem(slug) is { } problem)
        {
            return problem;
        }

        if (await db.Sites.AnyAsync(s => s.Slug == slug, cancellationToken))
        {
            return SlugTaken();
        }

        var name = request.Name.Trim();
        SiteDocument document;
        Guid? templateId = null;
        int? templateVersion = null;
        if (request.TemplateId is { } requestedTemplate)
        {
            var template = await db.StarterTemplates.FindAsync([requestedTemplate], cancellationToken);
            if (template is null || template.IsArchived || template.LatestVersion == 0)
            {
                return Problems.NotFound("Published template");
            }

            var version = await db.StarterTemplateVersions.SingleAsync(v => v.TemplateId == template.Id && v.Version == template.LatestVersion, cancellationToken);

            // An independent copy: later template versions never propagate to this site.
            document = version.Document;
            templateId = template.Id;
            templateVersion = version.Version;
        }
        else
        {
            document = SiteDocument.Blank(name);
        }

        var site = Site.Create(user.GetUserId(), name, slug, document, templateId, templateVersion, clock.GetUtcNow());
        db.Sites.Add(site);
        if (!await TrySaveAsync(db, cancellationToken))
        {
            return SlugTaken();
        }

        Revisions.SetETag(response, site.DraftRevision);
        return TypedResults.Created($"/api/sites/{site.Id}", await DetailAsync(site, pipeline, cancellationToken));
    }

    private static async Task<Results<Ok<SiteDetail>, ProblemHttpResult>> GetAsync(
        Guid id, StrataDbContext db, ContentWritePipeline pipeline, ClaimsPrincipal user, HttpResponse response, CancellationToken cancellationToken)
    {
        var site = await db.FindOwnedAsync(id, user, cancellationToken);
        if (site is null)
        {
            return Problems.NotFound("Site");
        }

        Revisions.SetETag(response, site.DraftRevision);
        return TypedResults.Ok(await DetailAsync(site, pipeline, cancellationToken));
    }

    private static async Task<Results<Ok<SiteSummary>, ProblemHttpResult>> UpdateAsync(
        Guid id, UpdateSiteRequest request, StrataDbContext db, TimeProvider clock, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var site = await db.FindOwnedAsync(id, user, cancellationToken);
        if (site is null)
        {
            return Problems.NotFound("Site");
        }

        var slug = request.Slug.Trim().ToLowerInvariant();
        if (SlugProblem(slug) is { } problem)
        {
            return problem;
        }

        if (slug != site.Slug && await db.Sites.AnyAsync(s => s.Slug == slug, cancellationToken))
        {
            return SlugTaken();
        }

        site.Rename(request.Name.Trim(), slug, clock.GetUtcNow());
        return await TrySaveAsync(db, cancellationToken) ? TypedResults.Ok(SiteSummary.From(site)) : SlugTaken();
    }

    /// <summary>Autosave target. Requires If-Match; validates schema, content and every locking rule against the stored draft.</summary>
    private static async Task<Results<Ok<SaveSiteDraftResponse>, ProblemHttpResult>> SaveDraftAsync(
        Guid id,
        SaveSiteDraftRequest request,
        StrataDbContext db,
        ContentWritePipeline pipeline,
        TimeProvider clock,
        ClaimsPrincipal user,
        HttpRequest httpRequest,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        var site = await db.FindOwnedAsync(id, user, cancellationToken);
        if (site is null)
        {
            return Problems.NotFound("Site");
        }

        if (Revisions.FromIfMatch(httpRequest) is not { } expectedRevision)
        {
            return Problems.PreconditionRequired();
        }

        if (expectedRevision != site.DraftRevision)
        {
            return Problems.Conflict("The draft was changed elsewhere", "Reload to see the latest version.");
        }

        var parsed = await pipeline.ParseSiteDocumentAsync(request.Document, site.Draft, DocumentAuthor.SiteOwner, user.GetUserId(), cancellationToken);
        if (!parsed.IsValid)
        {
            return Problems.ContentInvalid(parsed.Violations);
        }

        site.UpdateDraft(parsed.Value!, expectedRevision, clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);

        Revisions.SetETag(response, site.DraftRevision);
        return TypedResults.Ok(new SaveSiteDraftResponse(site.DraftRevision, site.HasUnpublishedChanges, ContentJson.ToElement(site.Draft)));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteAsync(Guid id, StrataDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var site = await db.FindOwnedAsync(id, user, cancellationToken);
        if (site is null)
        {
            return Problems.NotFound("Site");
        }

        db.Sites.Remove(site);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<SiteDetail> DetailAsync(Site site, ContentWritePipeline pipeline, CancellationToken cancellationToken)
    {
        var sections = await pipeline.LoadSectionsAsync(site.Draft.AllInstances().Select(i => i.Instance.VersionRef), cancellationToken);
        return SiteDetail.From(site, PublishedSectionDto.FromAll(sections.Values));
    }

    private static ProblemHttpResult? SlugProblem(string slug) =>
        !Site.IsValidSlug(slug)
            ? TypedResults.Problem(statusCode: StatusCodes.Status422UnprocessableEntity, title: "Invalid site slug", detail: "Use 3–40 lower-case letters, digits and single hyphens.", type: Problems.ContentInvalidType)
            : ReservedSlugs.Contains(slug)
                ? TypedResults.Problem(statusCode: StatusCodes.Status422UnprocessableEntity, title: "That slug is reserved", type: Problems.ContentInvalidType)
                : null;

    private static ProblemHttpResult SlugTaken() => Problems.Conflict("That site address is already taken");

    /// <summary>Saves, treating a unique-slug race as a handled conflict.</summary>
    private static async Task<bool> TrySaveAsync(StrataDbContext db, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }
}
