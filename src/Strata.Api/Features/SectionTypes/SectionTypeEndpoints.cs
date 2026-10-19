using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Strata.Api.Features.Content;
using Strata.Api.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using Strata.Domain.SectionTypes;
using Strata.Infrastructure.Persistence;

namespace Strata.Api.Features.SectionTypes;

public static class SectionTypeEndpoints
{
    public static IEndpointRouteBuilder MapSectionTypeEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/section-types")
            .WithTags("Section types")
            .RequireAuthorization(AuthenticationSetup.DesignerPolicy);

        group.MapGet("/", ListAsync).WithName("ListSectionTypes");
        group.MapPost("/", CreateAsync).WithName("CreateSectionType");
        group.MapGet("/{id:guid}", GetAsync).WithName("GetSectionType");
        group.MapPut("/{id:guid}", UpdateDraftAsync).WithName("UpdateSectionTypeDraft");
        group.MapPost("/{id:guid}/duplicate", DuplicateAsync).WithName("DuplicateSectionType");
        group.MapPost("/{id:guid}/archive", ArchiveAsync).WithName("ArchiveSectionType");
        group.MapPost("/{id:guid}/restore", RestoreAsync).WithName("RestoreSectionType");
        group.MapGet("/{id:guid}/versions", ListVersionsAsync).WithName("ListSectionTypeVersions");
        group.MapPost("/{id:guid}/versions", PublishVersionAsync).WithName("PublishSectionTypeVersion");
        group.MapGet("/{id:guid}/versions/{version:int}", GetVersionAsync).WithName("GetSectionTypeVersion");

        return routes;
    }

    private static async Task<Ok<List<SectionTypeSummary>>> ListAsync(StrataDbContext db, bool includeArchived = false, CancellationToken cancellationToken = default)
    {
        var types = await db.SectionTypes
            .Where(t => includeArchived || t.ArchivedAt == null)
            .OrderBy(t => t.Category).ThenBy(t => t.Name)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(types.Select(SectionTypeSummary.From).ToList());
    }

    private static async Task<Results<Created<SectionTypeDetail>, ProblemHttpResult>> CreateAsync(
        CreateSectionTypeRequest request,
        ContentWritePipeline pipeline,
        StrataDbContext db,
        TimeProvider clock,
        ClaimsPrincipal user,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        var definition = SectionDefinition.Empty;
        if (request.Definition is { } json)
        {
            var parsed = pipeline.ParseSectionDefinition(json);
            if (!parsed.IsValid)
            {
                return Problems.ContentInvalid(parsed.Violations);
            }

            definition = parsed.Value!;
        }

        var type = SectionType.Create(request.Name.Trim(), request.Category.Trim(), definition, user.GetUserId(), clock.GetUtcNow());
        db.SectionTypes.Add(type);
        await db.SaveChangesAsync(cancellationToken);

        Revisions.SetETag(response, type.DraftRevision);
        return TypedResults.Created($"/api/section-types/{type.Id}", SectionTypeDetail.From(type));
    }

    private static async Task<Results<Ok<SectionTypeDetail>, ProblemHttpResult>> GetAsync(
        Guid id,
        StrataDbContext db,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        var type = await db.SectionTypes.FindAsync([id], cancellationToken);
        if (type is null)
        {
            return Problems.NotFound("Section type");
        }

        Revisions.SetETag(response, type.DraftRevision);
        return TypedResults.Ok(SectionTypeDetail.From(type));
    }

    private static async Task<Results<Ok<SectionTypeDetail>, ProblemHttpResult>> UpdateDraftAsync(
        Guid id,
        UpdateSectionTypeRequest request,
        ContentWritePipeline pipeline,
        StrataDbContext db,
        TimeProvider clock,
        HttpRequest httpRequest,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        if (Revisions.FromIfMatch(httpRequest) is not { } expectedRevision)
        {
            return Problems.PreconditionRequired();
        }

        var type = await db.SectionTypes.FindAsync([id], cancellationToken);
        if (type is null)
        {
            return Problems.NotFound("Section type");
        }

        var parsed = pipeline.ParseSectionDefinition(request.Definition);
        if (!parsed.IsValid)
        {
            return Problems.ContentInvalid(parsed.Violations);
        }

        type.UpdateDraft(request.Name.Trim(), request.Category.Trim(), parsed.Value!, expectedRevision, clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);

        Revisions.SetETag(response, type.DraftRevision);
        return TypedResults.Ok(SectionTypeDetail.From(type));
    }

    private static async Task<Results<Created<SectionTypeDetail>, ProblemHttpResult>> DuplicateAsync(
        Guid id,
        DuplicateSectionTypeRequest request,
        StrataDbContext db,
        TimeProvider clock,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        var source = await db.SectionTypes.FindAsync([id], cancellationToken);
        if (source is null)
        {
            return Problems.NotFound("Section type");
        }

        var copy = source.Duplicate(request.Name?.Trim() ?? $"{source.Name} (copy)", user.GetUserId(), clock.GetUtcNow());
        db.SectionTypes.Add(copy);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created($"/api/section-types/{copy.Id}", SectionTypeDetail.From(copy));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ArchiveAsync(Guid id, StrataDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var type = await db.SectionTypes.FindAsync([id], cancellationToken);
        if (type is null)
        {
            return Problems.NotFound("Section type");
        }

        type.Archive(clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> RestoreAsync(Guid id, StrataDbContext db, CancellationToken cancellationToken)
    {
        var type = await db.SectionTypes.FindAsync([id], cancellationToken);
        if (type is null)
        {
            return Problems.NotFound("Section type");
        }

        type.Restore();
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<List<SectionTypeVersionDto>>, ProblemHttpResult>> ListVersionsAsync(Guid id, StrataDbContext db, CancellationToken cancellationToken)
    {
        if (!await db.SectionTypes.AnyAsync(t => t.Id == id, cancellationToken))
        {
            return Problems.NotFound("Section type");
        }

        var versions = await db.SectionTypeVersions
            .Where(v => v.SectionTypeId == id)
            .OrderByDescending(v => v.Version)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(versions.Select(SectionTypeVersionDto.From).ToList());
    }

    /// <summary>Freezes the current draft as version N after the pre-publish definition rules pass.</summary>
    private static async Task<Results<Created<SectionTypeVersionDto>, ProblemHttpResult>> PublishVersionAsync(
        Guid id,
        StrataDbContext db,
        TimeProvider clock,
        ClaimsPrincipal user,
        HttpRequest httpRequest,
        CancellationToken cancellationToken)
    {
        var type = await db.SectionTypes.FindAsync([id], cancellationToken);
        if (type is null)
        {
            return Problems.NotFound("Section type");
        }

        // Optional If-Match guards against publishing a draft other than the one the designer saw.
        if (Revisions.FromIfMatch(httpRequest) is { } expected && expected != type.DraftRevision)
        {
            return Problems.Conflict("The draft was changed elsewhere", "Reload before publishing.");
        }

        if (type.IsArchived)
        {
            return Problems.Conflict("Archived section types cannot be published");
        }

        var issues = SectionDefinitionRules.Validate(type.Draft);
        if (issues.Count > 0)
        {
            return Problems.ContentInvalid(issues, "The section cannot be published yet");
        }

        var version = type.PublishVersion(user.GetUserId(), clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created($"/api/section-types/{id}/versions/{version.Version}", SectionTypeVersionDto.From(version));
    }

    private static async Task<Results<Ok<SectionTypeVersionDto>, ProblemHttpResult>> GetVersionAsync(Guid id, int version, StrataDbContext db, CancellationToken cancellationToken)
    {
        var found = await db.SectionTypeVersions.FindAsync([id, version], cancellationToken);
        return found is null ? Problems.NotFound("Section type version") : TypedResults.Ok(SectionTypeVersionDto.From(found));
    }
}
