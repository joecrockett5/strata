using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;
using Strata.Domain.Identity;
using Strata.Infrastructure.Content;
using Strata.Infrastructure.Persistence;

namespace Strata.Api.Features.Content;

/// <summary>Either a parsed, sanitised, valid value or the reasons it was rejected.</summary>
public sealed record ContentResult<T>(T? Value, IReadOnlyList<ContentViolation> Violations)
    where T : class
{
    public bool IsValid => Violations.Count == 0 && Value is not null;
}

public static class ContentResult
{
    public static ContentResult<T> Invalid<T>(IReadOnlyList<ContentViolation> violations)
        where T : class => new(null, violations);
}

/// <summary>Whose rules apply to a document write.</summary>
public enum DocumentAuthor
{
    /// <summary>Designers editing starter templates: may set section and theme locks.</summary>
    Designer,

    /// <summary>Site owners editing their sites: bound by every lock from the template.</summary>
    SiteOwner,
}

/// <summary>
/// The single path every content write goes through:
/// JSON Schema → deserialise → sanitise rich text → semantic validation (incl. slot locks)
/// → version pins → owner lock rules (against the stored document).
/// </summary>
public sealed class ContentWritePipeline(
    IContentSchemaValidator schemaValidator,
    ContentSanitizer sanitizer,
    StrataDbContext db)
{
    public ContentResult<SectionDefinition> ParseSectionDefinition(JsonElement json)
    {
        var schemaViolations = schemaValidator.Validate(json, ContentDocumentKind.SectionDefinition);
        return schemaViolations.Count > 0
            ? ContentResult.Invalid<SectionDefinition>(schemaViolations)
            : new(sanitizer.Sanitize(ContentJson.Deserialize<SectionDefinition>(json)), []);
    }

    public ContentResult<Theme> ParseTheme(JsonElement json)
    {
        var schemaViolations = schemaValidator.Validate(json, ContentDocumentKind.Theme);
        return schemaViolations.Count > 0
            ? ContentResult.Invalid<Theme>(schemaViolations)
            : new(ContentJson.Deserialize<Theme>(json), []);
    }

    public async Task<ContentResult<SiteDocument>> ParseSiteDocumentAsync(
        JsonElement json,
        SiteDocument? previous,
        DocumentAuthor author,
        Guid authorId,
        CancellationToken cancellationToken)
    {
        var schemaViolations = schemaValidator.Validate(json, ContentDocumentKind.SiteDocument);
        if (schemaViolations.Count > 0)
        {
            return ContentResult.Invalid<SiteDocument>(schemaViolations);
        }

        var document = sanitizer.Sanitize(ContentJson.Deserialize<SiteDocument>(json));
        var violations = await ValidateDocumentAsync(document, previous, author, authorId, cancellationToken);
        return violations.Count > 0 ? ContentResult.Invalid<SiteDocument>(violations) : new(document, []);
    }

    /// <summary>Semantic and locking validation of an already-parsed document.</summary>
    public async Task<IReadOnlyList<ContentViolation>> ValidateDocumentAsync(
        SiteDocument document,
        SiteDocument? previous,
        DocumentAuthor author,
        Guid authorId,
        CancellationToken cancellationToken)
    {
        var context = await BuildContextAsync(document, authorId, cancellationToken);
        var violations = new List<ContentViolation>(SiteDocumentValidator.Validate(document, context));
        violations.AddRange(LockRules.ValidateVersionPins(previous, document, context));
        if (author == DocumentAuthor.SiteOwner && previous is not null)
        {
            violations.AddRange(LockRules.ValidateOwnerChanges(previous, document));
        }

        return violations;
    }

    /// <summary>Loads exactly the section versions and media the document references.</summary>
    public async Task<ContentValidationContext> BuildContextAsync(SiteDocument document, Guid authorId, CancellationToken cancellationToken)
    {
        var sections = await LoadSectionsAsync(document.AllInstances().Select(i => i.Instance.VersionRef), cancellationToken);
        var media = await LoadUsableMediaAsync(MediaReferences(document), authorId, cancellationToken);
        return new ContentValidationContext(sections, media);
    }

    public async Task<IReadOnlyDictionary<SectionVersionRef, PublishedSection>> LoadSectionsAsync(
        IEnumerable<SectionVersionRef> references,
        CancellationToken cancellationToken)
    {
        var refs = references.Distinct().ToList();
        var typeIds = refs.Select(r => r.SectionTypeId).Distinct().ToList();
        if (typeIds.Count == 0)
        {
            return new Dictionary<SectionVersionRef, PublishedSection>();
        }

        var rows = await db.SectionTypeVersions
            .Where(v => typeIds.Contains(v.SectionTypeId))
            .Join(db.SectionTypes, v => v.SectionTypeId, t => t.Id, (v, t) => new { Version = v, t.ArchivedAt })
            .ToListAsync(cancellationToken);

        var wanted = refs.ToHashSet();
        return rows
            .Where(row => wanted.Contains(row.Version.Ref))
            .ToDictionary(
                row => row.Version.Ref,
                row => new PublishedSection(row.Version.Ref, row.Version.Name, row.Version.Category, row.Version.Definition, row.ArchivedAt is not null));
    }

    /// <summary>Media an author may reference: their own uploads plus designer-provided media (used by templates).</summary>
    private async Task<IReadOnlySet<Guid>> LoadUsableMediaAsync(HashSet<Guid> mediaIds, Guid authorId, CancellationToken cancellationToken)
    {
        if (mediaIds.Count == 0)
        {
            return new HashSet<Guid>();
        }

        var designerRoleId = db.Roles.Where(r => r.Name == Roles.Designer).Select(r => r.Id);
        var usable = await db.MediaAssets
            .Where(m => mediaIds.Contains(m.Id))
            .Where(m => m.OwnerId == authorId
                || db.UserRoles.Any(ur => ur.UserId == m.OwnerId && designerRoleId.Contains(ur.RoleId)))
            .Select(m => m.Id)
            .ToListAsync(cancellationToken);
        return usable.ToHashSet();
    }

    private static HashSet<Guid> MediaReferences(SiteDocument document)
    {
        var ids = new HashSet<Guid>();
        if (document.Settings.Logo?.MediaId is { } logo)
        {
            ids.Add(logo);
        }

        foreach (var (instance, _, _) in document.AllInstances())
        {
            var values = instance.Values.Values.Concat(instance.Repeaters.Values.SelectMany(items => items.SelectMany(i => i.Values.Values)));
            foreach (var value in values)
            {
                if (value is ImageValue { MediaId: { } id })
                {
                    ids.Add(id);
                }
            }
        }

        return ids;
    }
}
