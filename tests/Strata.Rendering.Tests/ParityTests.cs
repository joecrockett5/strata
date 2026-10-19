namespace Strata.Rendering.Tests;

/// <summary>
/// The Razor renderer (published sites) must produce the same markup as the React renderer (editor
/// canvas) for every fixture in fixtures/parity. The expected HTML is generated from React with
/// `pnpm parity:generate`; see docs/adr/0001.
/// </summary>
public sealed class ParityTests
{
    private readonly StrataRenderer renderer = new();

    public static TheoryData<string> Fixtures => [.. ParityFixture.Names()];

    [Theory]
    [MemberData(nameof(Fixtures))]
    public async Task Razor_output_matches_the_React_snapshot(string name)
    {
        var fixture = ParityFixture.Load(name);

        var razor = HtmlNormalizer.Normalize(await fixture.RenderWithRazorAsync(renderer));
        var react = HtmlNormalizer.Normalize(fixture.ExpectedHtml);

        if (razor != react)
        {
            Assert.Fail($"Razor and React output differ for '{name}':\n{FirstDifference(react, razor)}");
        }
    }

    [Fact]
    public void Fixtures_cover_every_primitive()
    {
        var types = ParityFixture.Names()
            .Select(ParityFixture.Load)
            .SelectMany(f => System.Text.RegularExpressions.Regex.Matches(f.Json.GetRawText(), "\"\\$type\":\\s*\"(\\w+)\"").Select(m => m.Groups[1].Value))
            .ToHashSet();

        string[] primitives = ["section", "stack", "columns", "heading", "richText", "image", "button", "repeater", "nav", "contactForm", "spacer", "divider"];
        primitives.Where(p => !types.Contains(p)).ShouldBeEmpty();
    }

    private static string FirstDifference(string expected, string actual)
    {
        var e = expected.Split('\n');
        var a = actual.Split('\n');
        for (var i = 0; i < Math.Max(e.Length, a.Length); i++)
        {
            var left = i < e.Length ? e[i] : "<end>";
            var right = i < a.Length ? a[i] : "<end>";
            if (left != right)
            {
                var context = string.Join('\n', e.Skip(Math.Max(0, i - 4)).Take(4));
                return $"...\n{context}\nline {i + 1}:\n  react: {left}\n  razor: {right}";
            }
        }

        return "(no difference)";
    }
}
