using System.Text;
using System.Text.RegularExpressions;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;

namespace Strata.Rendering.Tests;

/// <summary>
/// Canonical form of an HTML fragment for parity comparisons. Differences that do not change the
/// rendered result are removed:
/// <list type="bullet">
/// <item>serialisation details (quoting, entity escaping, <c>required</c> vs <c>required=""</c>) — by parsing;</item>
/// <item>attribute order, class token order and inline-style declaration order/spacing — sorted;</item>
/// <item>formatting whitespace — runs collapse to one space, text is trimmed and whitespace-only
/// text nodes are dropped (the React snapshots are pretty-printed for review).</item>
/// </list>
/// Everything else — elements, nesting, attribute values, text — must match exactly.
/// </summary>
public static partial class HtmlNormalizer
{
    private static readonly HtmlParser Parser = new();

    public static string Normalize(string html)
    {
        var document = Parser.ParseDocument("<!DOCTYPE html><html><head></head><body></body></html>");
        var nodes = Parser.ParseFragment(html, document.Body!);
        var output = new StringBuilder();
        foreach (var node in nodes)
        {
            Write(node, output, 0);
        }

        return output.ToString();
    }

    private static void Write(INode node, StringBuilder output, int depth)
    {
        switch (node)
        {
            case IElement element:
                output.Append(' ', depth * 2).Append('<').Append(element.LocalName);
                foreach (var attribute in element.Attributes.OrderBy(a => a.Name, StringComparer.Ordinal))
                {
                    output.Append(' ').Append(attribute.Name).Append("=\"").Append(NormalizeAttribute(attribute.Name, attribute.Value)).Append('"');
                }

                output.Append(">\n");
                var children = element is AngleSharp.Html.Dom.IHtmlTemplateElement template ? template.Content.ChildNodes : element.ChildNodes;
                foreach (var child in children)
                {
                    Write(child, output, depth + 1);
                }

                output.Append(' ', depth * 2).Append("</").Append(element.LocalName).Append(">\n");
                break;
            case IText text:
                var collapsed = Whitespace().Replace(text.Data, " ").Trim();
                if (collapsed.Length > 0)
                {
                    output.Append(' ', depth * 2).Append(collapsed).Append('\n');
                }

                break;
        }
    }

    private static string NormalizeAttribute(string name, string value) => name switch
    {
        "class" => string.Join(' ', Whitespace().Split(value.Trim()).Where(t => t.Length > 0).Order(StringComparer.Ordinal)),
        "style" => string.Join(';', value.Split(';')
            .Select(d => d.Split(':', 2))
            .Where(p => p.Length == 2)
            .Select(p => $"{p[0].Trim()}:{Whitespace().Replace(p[1].Trim(), " ")}")
            .Order(StringComparer.Ordinal)),
        _ => value,
    };

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
