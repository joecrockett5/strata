namespace Strata.Domain.Content.Validation;

/// <summary>An immutable published section type version, as needed for validation and rendering.</summary>
public sealed class PublishedSection(
    SectionVersionRef reference,
    string name,
    string category,
    SectionDefinition definition,
    bool typeArchived)
{
    private SlotCatalog? catalog;

    public SectionVersionRef Ref { get; } = reference;
    public string Name { get; } = name;
    public string Category { get; } = category;
    public SectionDefinition Definition { get; } = definition;
    public bool TypeArchived { get; } = typeArchived;

    public SlotCatalog Catalog => catalog ??= SlotCatalog.For(Definition);
}

/// <summary>
/// Everything document validation needs from storage, preloaded so the rules stay pure:
/// the published section versions referenced by the document and the media the author may use.
/// </summary>
public sealed record ContentValidationContext(
    IReadOnlyDictionary<SectionVersionRef, PublishedSection> Sections,
    IReadOnlySet<Guid> UsableMedia);
