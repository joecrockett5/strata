namespace Strata.Domain.Content;

/// <summary>A node visited while walking a definition, with its JSON-pointer-style path.</summary>
public sealed record WalkedNode(Node Node, string Path, RepeaterNode? EnclosingRepeater);

public static class DefinitionWalker
{
    /// <summary>Depth-first walk of every node under (and including) the root.</summary>
    public static IEnumerable<WalkedNode> Walk(SectionDefinition definition) => Walk(definition.Root, "/root", null);

    private static IEnumerable<WalkedNode> Walk(Node node, string path, RepeaterNode? repeater)
    {
        yield return new WalkedNode(node, path, repeater);

        var childRepeater = node as RepeaterNode ?? repeater;
        var children = node switch
        {
            ColumnsNode columns => columns.Columns.SelectMany((column, c) =>
                column.Children.Select((child, i) => (child, $"{path}/columns/{c}/children/{i}"))),
            _ => node.ChildNodes().Select((child, i) => (child, $"{path}/children/{i}")),
        };

        foreach (var (child, childPath) in children)
        {
            foreach (var walked in Walk(child, childPath, childRepeater))
            {
                yield return walked;
            }
        }
    }
}

/// <summary>Slots in a repeater's item template.</summary>
public sealed record RepeaterCatalog(RepeaterNode Node, IReadOnlyDictionary<string, SlotDefinition> Slots);

/// <summary>
/// Index of a definition's slots: top-level slots (stored in <see cref="SectionInstance.Values"/>)
/// and per-repeater slots (stored per item). Built from validated definitions, where keys are unique;
/// for invalid drafts the first occurrence wins.
/// </summary>
public sealed class SlotCatalog
{
    private SlotCatalog(
        IReadOnlyDictionary<string, SlotDefinition> slots,
        IReadOnlyDictionary<string, RepeaterCatalog> repeaters)
    {
        Slots = slots;
        Repeaters = repeaters;
    }

    public IReadOnlyDictionary<string, SlotDefinition> Slots { get; }
    public IReadOnlyDictionary<string, RepeaterCatalog> Repeaters { get; }

    public static SlotCatalog For(SectionDefinition definition)
    {
        var slots = new Dictionary<string, SlotDefinition>(StringComparer.Ordinal);
        var repeaterSlots = new Dictionary<string, Dictionary<string, SlotDefinition>>(StringComparer.Ordinal);
        var repeaterNodes = new Dictionary<string, RepeaterNode>(StringComparer.Ordinal);

        foreach (var (node, _, repeater) in DefinitionWalker.Walk(definition))
        {
            if (node is RepeaterNode r && repeater is null)
            {
                repeaterNodes.TryAdd(r.Key, r);
                repeaterSlots.TryAdd(r.Key, new Dictionary<string, SlotDefinition>(StringComparer.Ordinal));
                continue;
            }

            var target = repeater is null ? slots : repeaterSlots[repeater.Key];
            foreach (var slot in node.OwnSlots())
            {
                target.TryAdd(slot.Key, slot);
            }
        }

        return new SlotCatalog(
            slots,
            repeaterNodes.ToDictionary(
                kv => kv.Key,
                kv => new RepeaterCatalog(kv.Value, repeaterSlots[kv.Key]),
                StringComparer.Ordinal));
    }
}
