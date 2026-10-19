using Strata.Domain.Content;

namespace Strata.Infrastructure.Content;

/// <summary>Applies the rich-text sanitiser to every rich-text value and default in a document.</summary>
public sealed class ContentSanitizer(IRichTextSanitizer sanitizer)
{
    public SiteDocument Sanitize(SiteDocument document) => document with
    {
        Header = document.Header is null ? null : Sanitize(document.Header),
        Footer = document.Footer is null ? null : Sanitize(document.Footer),
        Pages = [.. document.Pages.Select(page => page with { Sections = [.. page.Sections.Select(Sanitize)] })],
    };

    public SectionDefinition Sanitize(SectionDefinition definition) =>
        definition with { Root = (SectionNode)Sanitize(definition.Root) };

    private SectionInstance Sanitize(SectionInstance instance) => instance with
    {
        Values = Sanitize(instance.Values),
        Repeaters = instance.Repeaters.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<RepeaterItem>)[.. kv.Value.Select(item => item with { Values = Sanitize(item.Values) })],
            StringComparer.Ordinal),
    };

    private Dictionary<string, SlotValue> Sanitize(IReadOnlyDictionary<string, SlotValue> values) =>
        values.ToDictionary(
            kv => kv.Key,
            kv => kv.Value is RichTextValue rich ? new RichTextValue(sanitizer.Sanitize(rich.Html)) : kv.Value,
            StringComparer.Ordinal);

    private Node Sanitize(Node node) => node switch
    {
        SectionNode n => n with { Children = SanitizeAll(n.Children) },
        StackNode n => n with { Children = SanitizeAll(n.Children) },
        RepeaterNode n => n with { Children = SanitizeAll(n.Children) },
        ColumnsNode n => n with { Columns = [.. n.Columns.Select(c => new Column(SanitizeAll(c.Children)))] },
        RichTextNode n => n with { Content = n.Content with { Default = new RichTextValue(sanitizer.Sanitize(n.Content.Default.Html)) } },
        _ => node,
    };

    private Node[] SanitizeAll(IReadOnlyList<Node> nodes) => [.. nodes.Select(Sanitize)];
}
