using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Strata.Api.Features.Content;
using Strata.Api.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Templates;
using Strata.Infrastructure.Persistence;

namespace Strata.Api.Features.Templates;

public static class TemplateEndpoints
{
    public static IEndpointRouteBuilder MapTemplateEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/templates/published", ListPublishedAsync)
            .WithTags("Templates")
            .WithName("ListPublishedTemplates")
            .RequireAuthorization(AuthenticationSetup.AuthorPolicy);

        var group = routes.MapGroup("/api/templates")
            .WithTags("Templates")
            .RequireAuthorization(AuthenticationSetup.DesignerPolicy);

        group.MapGet("/", ListAsync).WithName("ListTemplates");
        group.MapPost("/", CreateAsync).WithName("CreateTemplate");
        group.MapGet("/{id:guid}", GetAsync).WithName("GetTemplate");
        group.MapPut("/{id:guid}", UpdateDraftAsync).WithName("UpdateTemplateDraft");
        group.MapPost("/{id:guid}/versions", PublishVersionAsync).WithName("PublishTemplateVersion");
        group.MapPost("/{id:guid}/archive", ArchiveAsync).WithName("ArchiveTemplate");
        group.MapPost("/{id:guid}/restore", RestoreAsync).WithName("RestoreTemplate");

        return routes;
    }

    private static async Task<Ok<List<PublishedTemplateDto>>> ListPublishedAsync(StrataDbContext db, CancellationToken cancellationToken)
    {
        var latest = await db.StarterTemplates
            .Where(t => t.ArchivedAt == null && t.LatestVersion > 0)
            .Join(db.StarterTemplateVersions, t => new { t.Id, Version = t.LatestVersion }, v => new { Id = v.TemplateId, v.Version }, (t, v) => v)
            .OrderBy(v => v.Name)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(latest
            .Select(v => new PublishedTemplateDto(v.TemplateId, v.Version, v.Name, v.Description, v.ThumbnailMediaId, v.Document.Pages.Count))
            .ToList());
    }

    private static async Task<Ok<List<TemplateSummary>>> ListAsync(StrataDbContext db, bool includeArchived = false, CancellationToken cancellationToken = default)
    {
        var templates = await db.StarterTemplates
            .Where(t => includeArchived || t.ArchivedAt == null)
            .OrderBy(t => t.Name)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(templates.Select(TemplateSummary.From).ToList());
    }

    private static async Task<Results<Created<TemplateDetail>, ProblemHttpResult>> CreateAsync(
        CreateTemplateRequest request, StrataDbContext db, TimeProvider clock, ClaimsPrincipal user, HttpResponse response, CancellationToken cancellationToken)
    {
        var document = SiteDocument.Blank("Your firm");
        if (request.ThemePresetId is { } presetId)
        {
            var preset = await db.ThemePresets.FindAsync([presetId], cancellationToken);
            if (preset is null)
            {
                return Problems.NotFound("Theme preset");
            }

            document = document with { Theme = preset.Theme };
        }

        var template = StarterTemplate.Create(request.Name.Trim(), request.Description?.Trim() ?? string.Empty, document, user.GetUserId(), clock.GetUtcNow());
        db.StarterTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);

        Revisions.SetETag(response, template.DraftRevision);
        return TypedResults.Created($"/api/templates/{template.Id}", TemplateDetail.From(template, []));
    }

    private static async Task<Results<Ok<TemplateDetail>, ProblemHttpResult>> GetAsync(
        Guid id, StrataDbContext db, ContentWritePipeline pipeline, HttpResponse response, CancellationToken cancellationToken)
    {
        var template = await db.StarterTemplates.FindAsync([id], cancellationToken);
        if (template is null)
        {
            return Problems.NotFound("Template");
        }

        var sections = await pipeline.LoadSectionsAsync(template.Draft.AllInstances().Select(i => i.Instance.VersionRef), cancellationToken);
        Revisions.SetETag(response, template.DraftRevision);
        return TypedResults.Ok(TemplateDetail.From(template, PublishedSectionDto.FromAll(sections.Values)));
    }

    private static async Task<Results<Ok<TemplateDetail>, ProblemHttpResult>> UpdateDraftAsync(
        Guid id,
        UpdateTemplateRequest request,
        ContentWritePipeline pipeline,
        StrataDbContext db,
        TimeProvider clock,
        ClaimsPrincipal user,
        HttpRequest httpRequest,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        if (Revisions.FromIfMatch(httpRequest) is not { } expectedRevision)
        {
            return Problems.PreconditionRequired();
        }

        var template = await db.StarterTemplates.FindAsync([id], cancellationToken);
        if (template is null)
        {
            return Problems.NotFound("Template");
        }

        var parsed = await pipeline.ParseSiteDocumentAsync(request.Document, template.Draft, DocumentAuthor.Designer, user.GetUserId(), cancellationToken);
        if (!parsed.IsValid)
        {
            return Problems.ContentInvalid(parsed.Violations);
        }

        if (request.ThumbnailMediaId is { } thumbnail && !await db.MediaAssets.AnyAsync(m => m.Id == thumbnail, cancellationToken))
        {
            return Problems.NotFound("Thumbnail image");
        }

        template.UpdateDraft(request.Name.Trim(), request.Description.Trim(), request.ThumbnailMediaId, parsed.Value!, expectedRevision, clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);

        var sections = await pipeline.LoadSectionsAsync(template.Draft.AllInstances().Select(i => i.Instance.VersionRef), cancellationToken);
        Revisions.SetETag(response, template.DraftRevision);
        return TypedResults.Ok(TemplateDetail.From(template, PublishedSectionDto.FromAll(sections.Values)));
    }

    private static async Task<Results<Created<TemplateVersionDto>, ProblemHttpResult>> PublishVersionAsync(
        Guid id, ContentWritePipeline pipeline, StrataDbContext db, TimeProvider clock, ClaimsPrincipal user, HttpRequest httpRequest, CancellationToken cancellationToken)
    {
        var template = await db.StarterTemplates.FindAsync([id], cancellationToken);
        if (template is null)
        {
            return Problems.NotFound("Template");
        }

        if (Revisions.FromIfMatch(httpRequest) is { } expected && expected != template.DraftRevision)
        {
            return Problems.Conflict("The draft was changed elsewhere", "Reload before publishing.");
        }

        if (template.IsArchived)
        {
            return Problems.Conflict("Archived templates cannot be published");
        }

        // Re-check the stored draft: it was valid when saved, but referenced media could have changed since.
        var issues = await pipeline.ValidateDocumentAsync(template.Draft, template.Draft, DocumentAuthor.Designer, user.GetUserId(), cancellationToken);
        if (issues.Count > 0)
        {
            return Problems.ContentInvalid(issues, "The template cannot be published yet");
        }

        var version = template.PublishVersion(user.GetUserId(), clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created($"/api/templates/{id}", new TemplateVersionDto(id, version.Version, version.PublishedAt));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ArchiveAsync(Guid id, StrataDbContext db, TimeProvider clock, CancellationToken cancellationToken)
    {
        var template = await db.StarterTemplates.FindAsync([id], cancellationToken);
        if (template is null)
        {
            return Problems.NotFound("Template");
        }

        template.Archive(clock.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> RestoreAsync(Guid id, StrataDbContext db, CancellationToken cancellationToken)
    {
        var template = await db.StarterTemplates.FindAsync([id], cancellationToken);
        if (template is null)
        {
            return Problems.NotFound("Template");
        }

        template.Restore();
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.NoContent();
    }
}
