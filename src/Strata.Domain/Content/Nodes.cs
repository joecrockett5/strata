using System.Text.Json.Serialization;

namespace Strata.Domain.Content;

/// <summary>A primitive in a section definition tree. Primitives are defined in code.</summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "$type")]
[JsonDerivedType(typeof(SectionNode), "section")]
[JsonDerivedType(typeof(StackNode), "stack")]
[JsonDerivedType(typeof(ColumnsNode), "columns")]
[JsonDerivedType(typeof(HeadingNode), "heading")]
[JsonDerivedType(typeof(RichTextNode), "richText")]
[JsonDerivedType(typeof(ImageNode), "image")]
[JsonDerivedType(typeof(ButtonNode), "button")]
[JsonDerivedType(typeof(RepeaterNode), "repeater")]
[JsonDerivedType(typeof(NavNode), "nav")]
[JsonDerivedType(typeof(ContactFormNode), "contactForm")]
[JsonDerivedType(typeof(SpacerNode), "spacer")]
[JsonDerivedType(typeof(DividerNode), "divider")]
public abstract record Node
{
    public required string Id { get; init; }

    // Computed members are methods so serialisers never pick them up (attributes on a base
    // property are not inherited by overrides).

    /// <summary>Slots owned directly by this node (not by its descendants).</summary>
    public virtual IEnumerable<SlotDefinition> OwnSlots() => [];

    /// <summary>Direct child nodes, flattening column wrappers.</summary>
    public virtual IEnumerable<Node> ChildNodes() => [];
}

/// <summary>Root of every section definition.</summary>
public sealed record SectionNode : Node
{
    public required SectionBackground Background { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ImageSlotDefinition? BackgroundImage { get; init; }

    public required Spacing PaddingY { get; init; }
    public required ContentWidth Width { get; init; }
    public required IReadOnlyList<Node> Children { get; init; }

    public override IEnumerable<SlotDefinition> OwnSlots() => BackgroundImage is null ? [] : [BackgroundImage];
    public override IEnumerable<Node> ChildNodes() => Children;
}

public sealed record StackNode : Node
{
    public required Spacing Gap { get; init; }
    public required CrossAlign Align { get; init; }
    public required IReadOnlyList<Node> Children { get; init; }

    public override IEnumerable<Node> ChildNodes() => Children;
}

public sealed record Column(IReadOnlyList<Node> Children);

public sealed record ColumnsNode : Node
{
    public required ColumnRatio Ratio { get; init; }
    public required Spacing Gap { get; init; }
    public required CrossAlign Valign { get; init; }
    public required Breakpoint StackAt { get; init; }
    public required IReadOnlyList<Column> Columns { get; init; }

    public override IEnumerable<Node> ChildNodes() => Columns.SelectMany(c => c.Children);
}

public sealed record HeadingNode : Node
{
    public required int Level { get; init; }
    public required Align Align { get; init; }
    public required TextSlotDefinition Text { get; init; }

    public override IEnumerable<SlotDefinition> OwnSlots() => [Text];
}

public sealed record RichTextNode : Node
{
    public required Align Align { get; init; }
    public required RichTextSlotDefinition Content { get; init; }

    public override IEnumerable<SlotDefinition> OwnSlots() => [Content];
}

public sealed record ImageNode : Node
{
    public required ImageAspect Aspect { get; init; }
    public required ImageFit Fit { get; init; }
    public required ImageRadius Radius { get; init; }
    public required ImageSlotDefinition Image { get; init; }

    public override IEnumerable<SlotDefinition> OwnSlots() => [Image];
}

public sealed record ButtonNode : Node
{
    public required ButtonVariant Variant { get; init; }
    public required Align Align { get; init; }
    public required TextSlotDefinition Label { get; init; }
    public required LinkSlotDefinition Link { get; init; }

    public override IEnumerable<SlotDefinition> OwnSlots() => [Label, Link];
}

/// <summary>Repeats <see cref="Children"/> once per item; slots inside are stored per item.</summary>
public sealed record RepeaterNode : Node
{
    public required string Key { get; init; }
    public required string ItemLabel { get; init; }
    public required int Min { get; init; }
    public required int Max { get; init; }
    public required int DefaultItemCount { get; init; }
    public required RepeaterLayout Layout { get; init; }
    public required Spacing Gap { get; init; }
    public required IReadOnlyList<Node> Children { get; init; }

    public override IEnumerable<Node> ChildNodes() => Children;
}

public sealed record NavNode : Node;

public sealed record ContactFormNode : Node
{
    public required TextSlotDefinition SubmitLabel { get; init; }
    public required TextSlotDefinition SuccessMessage { get; init; }

    public override IEnumerable<SlotDefinition> OwnSlots() => [SubmitLabel, SuccessMessage];
}

public sealed record SpacerNode : Node
{
    public required Spacing Size { get; init; }
}

public sealed record DividerNode : Node;

/// <summary>A section type's tree of primitives.</summary>
public sealed record SectionDefinition
{
    public const int CurrentSchemaVersion = 1;

    public int SchemaVersion { get; init; } = CurrentSchemaVersion;
    public required SectionNode Root { get; init; }

    /// <summary>The starting point for a new section type: an empty root section.</summary>
    public static SectionDefinition Empty { get; } = new()
    {
        Root = new SectionNode
        {
            Id = "root",
            Background = SectionBackground.Background,
            PaddingY = Spacing.Lg,
            Width = ContentWidth.Standard,
            Children = [],
        },
    };
}
