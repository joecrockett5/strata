using Strata.Domain.Content;

namespace Strata.Rendering;

/// <summary>Rendering decisions shared with @strata/renderer/src/model.ts.</summary>
public static class RenderRules
{
    public static string SectionDomId(Guid instanceId) => $"section-{instanceId}";

    /// <summary>The value to render: locked slots and missing values use the designer's default.</summary>
    public static T ValueOf<T>(SlotDefinition slot, SlotScope scope)
        where T : SlotValue =>
        !slot.IsLocked && scope.Values.TryGetValue(slot.Key, out var value) && value is T typed
            ? typed
            : (T)slot.DefaultValue();

    /// <summary>Resolves a link to an href; null for empty or broken links.</summary>
    public static string? HrefOf(LinkValue link, RenderContext context) => link.Target switch
    {
        UrlLinkTarget url => url.Url,
        PageLinkTarget page => context.PageHrefs.TryGetValue(page.PageId, out var href) ? href : null,
        _ => null,
    };

    /// <summary>The instance's items, or <c>DefaultItemCount</c> empty items that render slot defaults.</summary>
    public static IReadOnlyList<RepeaterItem> RepeaterItems(RepeaterNode node, SectionInstance instance) =>
        instance.Repeaters.TryGetValue(node.Key, out var items)
            ? items
            : [.. Enumerable.Range(0, node.DefaultItemCount).Select(_ => new RepeaterItem(Guid.Empty, new Dictionary<string, SlotValue>()))];

    /// <summary>Empty headings and rich text are omitted (mirrors <c>value.trim() === ""</c>).</summary>
    public static bool IsBlank(string text) => text.Trim().Length == 0;
}

public sealed record ContactFieldSpec(string Name, string Label, string Type, bool Required, int MaxLength, string? AutoComplete);

/// <summary>The fixed contact fields (mirrors <c>contactFields</c> in @strata/renderer).</summary>
public static class ContactFields
{
    public static IReadOnlyList<ContactFieldSpec> All { get; } =
    [
        new("name", "Name", "text", true, 100, "name"),
        new("email", "Email", "email", true, 200, "email"),
        new("phone", "Phone", "tel", false, 40, "tel"),
        new("message", "Message", "textarea", true, 4000, null),
    ];
}

/// <summary>Per-section render state cascaded to every node component.</summary>
public sealed record SectionRenderState(RenderContext Context, SectionDefinition Definition, SectionInstance Instance);
