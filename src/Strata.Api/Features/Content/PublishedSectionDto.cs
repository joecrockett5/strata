using System.Text.Json;
using Strata.Domain.Content;
using Strata.Domain.Content.Validation;

namespace Strata.Api.Features.Content;

/// <summary>A published section type version (immutable) with its <c>SectionDefinition</c>.</summary>
public sealed record PublishedSectionDto(Guid SectionTypeId, int Version, string Name, string Category, JsonElement Definition)
{
    public static PublishedSectionDto From(PublishedSection section) =>
        new(section.Ref.SectionTypeId, section.Ref.Version, section.Name, section.Category, ContentJson.ToElement(section.Definition));

    public static List<PublishedSectionDto> FromAll(IEnumerable<PublishedSection> sections) =>
        [.. sections.OrderBy(s => s.Name, StringComparer.Ordinal).ThenBy(s => s.Ref.Version).Select(From)];
}
