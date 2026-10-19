using System.Text.Json.Serialization;

namespace Strata.Domain.Content;

/// <summary>A value stored for a slot. Tagged with <c>$type</c> so it is self-describing.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "$type")]
[JsonDerivedType(typeof(TextValue), "text")]
[JsonDerivedType(typeof(RichTextValue), "richText")]
[JsonDerivedType(typeof(ImageValue), "image")]
[JsonDerivedType(typeof(LinkValue), "link")]
public abstract record SlotValue
{
    [JsonIgnore]
    public abstract SlotType Type { get; }
}

public sealed record TextValue(string Text) : SlotValue
{
    [JsonIgnore]
    public override SlotType Type => SlotType.Text;
}

/// <summary>Sanitised HTML (allowlist: p, br, strong, em, a, ul, ol, li).</summary>
public sealed record RichTextValue(string Html) : SlotValue
{
    [JsonIgnore]
    public override SlotType Type => SlotType.RichText;
}

/// <summary>Media reference plus alt text; alt text belongs to the use, not to the media asset.</summary>
public sealed record ImageValue(Guid? MediaId, string Alt) : SlotValue
{
    [JsonIgnore]
    public override SlotType Type => SlotType.Image;
}

public sealed record LinkValue(LinkTarget? Target) : SlotValue
{
    [JsonIgnore]
    public override SlotType Type => SlotType.Link;
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(PageLinkTarget), "page")]
[JsonDerivedType(typeof(UrlLinkTarget), "url")]
public abstract record LinkTarget;

public sealed record PageLinkTarget(Guid PageId) : LinkTarget;

public sealed record UrlLinkTarget(string Url) : LinkTarget
{
    private static readonly string[] AllowedPrefixes = ["http://", "https://", "mailto:", "tel:"];

    public static bool IsAllowed(string url) =>
        AllowedPrefixes.Any(prefix => url.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
}
