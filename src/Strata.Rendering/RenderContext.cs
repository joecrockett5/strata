using Strata.Domain.Content;

namespace Strata.Rendering;

public sealed record NavLink(Guid PageId, string Title, string Href, bool Current);

/// <summary>Site-wide data for navigation. Mirrors <c>SiteInfo</c> in @strata/renderer.</summary>
public sealed record SiteInfo
{
    public required string FirmName { get; init; }
    public required ImageValue? Logo { get; init; }
    public required string HomeHref { get; init; }
    public required IReadOnlyList<NavLink> Nav { get; init; }
}

public enum ContactFormStatus
{
    Success,
    Invalid,
}

/// <summary>Server-side state of a contact form after a submission.</summary>
public sealed record ContactFormState(
    Guid SectionId,
    ContactFormStatus Status,
    IReadOnlyDictionary<string, string>? Values = null,
    IReadOnlyDictionary<string, string>? Errors = null);

/// <summary>
/// Everything the renderer needs beyond the content. Plain data, identical in shape to
/// <c>RenderContext</c> in @strata/renderer, so parity fixtures drive both renderers.
/// </summary>
public sealed record RenderContext
{
    public required SiteInfo Site { get; init; }

    /// <summary>href for every page id that links may target.</summary>
    public required IReadOnlyDictionary<Guid, string> PageHrefs { get; init; }

    public required string MediaBase { get; init; }
    public required string FormAction { get; init; }
    public required Guid PageId { get; init; }
    public ContactFormState? FormState { get; init; }

    public string MediaUrl(Guid mediaId) => $"{MediaBase}{mediaId}";
}

/// <summary>Slot values in scope: the section instance's own, or one repeater item's.</summary>
public sealed record SlotScope(Guid InstanceId, IReadOnlyDictionary<string, SlotValue> Values);
