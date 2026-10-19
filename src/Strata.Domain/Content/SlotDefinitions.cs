using System.Text.Json.Serialization;

namespace Strata.Domain.Content;

/// <summary>
/// A content-bearing field inside a section definition. Embedded on the node that owns it;
/// the concrete type follows from the node (a heading's <c>text</c> is always a text slot).
/// </summary>
public abstract record SlotDefinition
{
    public required string Key { get; init; }
    public required string Label { get; init; }
    public required SlotMode Mode { get; init; }
    public required bool Required { get; init; }

    /// <summary>Serialised as the schema's <c>type</c> constant; ignored on read.</summary>
    public abstract SlotType Type { get; }

    /// <summary>The default as a <see cref="SlotValue"/> (a method so it is never serialised).</summary>
    public abstract SlotValue DefaultValue();

    [JsonIgnore]
    public bool IsLocked => Mode == SlotMode.Locked;
}

public sealed record TextSlotDefinition : SlotDefinition
{
    public override SlotType Type => SlotType.Text;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? MaxLength { get; init; }

    public required TextValue Default { get; init; }

    public override SlotValue DefaultValue() => Default;
}

public sealed record RichTextSlotDefinition : SlotDefinition
{
    public override SlotType Type => SlotType.RichText;

    /// <summary>Maximum visible text length (tags excluded).</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? MaxLength { get; init; }

    public required RichTextValue Default { get; init; }

    public override SlotValue DefaultValue() => Default;
}

public sealed record ImageSlotDefinition : SlotDefinition
{
    public override SlotType Type => SlotType.Image;

    public required ImageValue Default { get; init; }

    public override SlotValue DefaultValue() => Default;
}

public sealed record LinkSlotDefinition : SlotDefinition
{
    public override SlotType Type => SlotType.Link;

    public required LinkValue Default { get; init; }

    public override SlotValue DefaultValue() => Default;
}
