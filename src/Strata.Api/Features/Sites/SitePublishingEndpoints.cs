using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Strata.Api.Features.Content;
using Strata.Api.Infrastructure;
using Strata.Domain.Content.Validation;
using Strata.Domain.Publishing;
using Strata.Domain.Sites;
using Strata.Infrastructure.Persistence;

namespace Strata.Api.Features.Sites;

public sealed record PublishIssueDto(IssueSeverity Severity, string Code, string Message, string Path, Guid? PageId, Guid? InstanceId, string? SlotKey)
{
    public static PublishIssueDto From(PublishIssue issue) =>
        new(issue.Severity, issue.Code, issue.Message, issue.Path, issue.PageId, issue.InstanceId, issue.SlotKey);
}

/// <summary>Publish checks for the current draft revision.</summary>
public sealed record PublishChecksResponse(long Revision, int Errors, int Warnings, List<PublishIssueDto> Issues);

public sealed record PublishResponse(int Version, DateTimeOffset PublishedAt, string Url, List<PublishIssueDto> Warnings);

public sealed record ContactSubmissionDto(Guid Id, Guid PageId, string Name, string Email, string? Phone, string Message, DateTimeOffset CreatedAt);

/// <summary>Publish checks, publishing (immutable snapshots) and contact submissions for a site's owner.</summary>
public static class SitePublishingEndpoints
{
    public static IEndpointRouteBuilder MapSitePublishingEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/sites/{id:guid}")
            .WithTags("Sites")
            .RequireAuthorization(AuthenticationSetup.SiteOwnerPolicy);

        group.MapGet("/publish-checks", ChecksAsync).WithName("GetPublishChecks");
        group.MapPost("/publish", PublishAsync).WithName("PublishSite");
        group.MapGet("/submissions", SubmissionsAsync).WithName("ListContactSubmissions");
        return routes;
    }

    private static async Task<(PublishedSnapshot Snapshot, IReadOnlyList<PublishIssue> Issues)> AnalyseAsync(Site site, ContentWritePipeline pipeline, CancellationToken cancellationToken)
    {
        var sections = await pipeline.LoadSectionsAsync(site.Draft.AllInstances().Select(i => i.Instance.VersionRef), cancellationToken);
        var definitions = sections.ToDictionary(kv => kv.Key.ToString(), kv => kv.Value.Definition, StringComparer.Ordinal);
        return (new PublishedSnapshot(site.Draft, definitions), PublishChecks.Run(site.Draft, definitions));
    }

    private static async Task<Results<Ok<PublishChecksResponse>, ProblemHttpResult>> ChecksAsync(
        Guid id, StrataDbContext db, ContentWritePipeline pipeline, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var site = await db.FindOwnedAsync(id, user, cancellationToken);
        if (site is null)
        {
            return Problems.NotFound("Site");
        }

        var (_, issues) = await AnalyseAsync(site, pipeline, cancellationToken);
        return TypedResults.Ok(new PublishChecksResponse(
            site.DraftRevision,
            issues.Count(i => i.Severity == IssueSeverity.Error),
            issues.Count(i => i.Severity == IssueSeverity.Warning),
            [.. issues.Select(PublishIssueDto.From)]));
    }

    /// <summary>
    /// Snapshots the draft (with the exact section definitions it uses) into an immutable
    /// published version. Errors from the publish checks block it; warnings do not.
    /// </summary>
    private static async Task<Results<Created<PublishResponse>, ProblemHttpResult>> PublishAsync(
        Guid id, StrataDbContext db, ContentWritePipeline pipeline, TimeProvider clock, ClaimsPrincipal user, HttpRequest request, CancellationToken cancellationToken)
    {
        var site = await db.FindOwnedAsync(id, user, cancellationToken);
        if (site is null)
        {
            return Problems.NotFound("Site");
        }

        // Optional If-Match: publish exactly the revision the owner reviewed.
        if (Revisions.FromIfMatch(request) is { } expected && expected != site.DraftRevision)
        {
            return Problems.Conflict("The draft was changed elsewhere", "Reload before publishing.");
        }

        var (snapshot, issues) = await AnalyseAsync(site, pipeline, cancellationToken);
        var errors = issues.Where(i => i.Severity == IssueSeverity.Error).ToList();
        if (errors.Count > 0)
        {
            return Problems.ContentInvalid([.. errors.Select(e => new ContentViolation(e.Code, e.Path, e.Message))], "Fix the errors before publishing");
        }

        var latest = await db.PublishedSiteVersions.Where(v => v.SiteId == site.Id).MaxAsync(v => (int?)v.VersionNumber, cancellationToken) ?? 0;
        var version = PublishedSiteVersion.Create(site, latest + 1, snapshot, user.GetUserId(), clock.GetUtcNow());
        db.PublishedSiteVersions.Add(version);
        site.MarkPublished(version);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Problems.Conflict("The site was published at the same time elsewhere", "Reload and try again.");
        }

        var url = $"/s/{site.Slug}/";
        return TypedResults.Created(url, new PublishResponse(
            version.VersionNumber,
            version.PublishedAt,
            url,
            [.. issues.Where(i => i.Severity == IssueSeverity.Warning).Select(PublishIssueDto.From)]));
    }

    private static async Task<Results<Ok<List<ContactSubmissionDto>>, ProblemHttpResult>> SubmissionsAsync(
        Guid id, StrataDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken)
    {
        var site = await db.FindOwnedAsync(id, user, cancellationToken);
        if (site is null)
        {
            return Problems.NotFound("Site");
        }

        var submissions = await db.ContactSubmissions
            .Where(s => s.SiteId == site.Id)
            .OrderByDescending(s => s.CreatedAt)
            .Take(500)
            .Select(s => new ContactSubmissionDto(s.Id, s.PageId, s.Name, s.Email, s.Phone, s.Message, s.CreatedAt))
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(submissions);
    }
}
