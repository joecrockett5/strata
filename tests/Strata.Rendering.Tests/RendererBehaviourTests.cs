using Strata.Domain.Content;
using static Strata.Testing.Content;

namespace Strata.Rendering.Tests;

public sealed class RendererBehaviourTests
{
    private static readonly RenderContext Context = new()
    {
        Site = new SiteInfo { FirmName = "Firm", Logo = null, HomeHref = "/", Nav = [] },
        PageHrefs = new Dictionary<Guid, string>(),
        MediaBase = "/media/",
        FormAction = "/_contact",
        PageId = Guid.NewGuid(),
    };

    private readonly StrataRenderer renderer = new();

    [Fact]
    public async Task Text_values_are_html_escaped()
    {
        var definition = Section(Heading("h", TextSlot("title")));
        var instance = Instance(new SectionVersionRef(Guid.NewGuid(), 1), values: Values(("title", Text("<script>alert(1)</script>"))));

        var html = await renderer.RenderSectionAsync(Theme.Default, definition, instance, Context);

        html.ShouldNotContain("<script>");
        html.ShouldContain("&lt;script&gt;");
    }

    [Fact]
    public async Task Locked_slots_render_the_designers_value_even_if_a_value_was_stored()
    {
        var definition = Section(Heading("h", TextSlot("legal", "Regulated disclosure", mode: SlotMode.Locked)));
        var instance = Instance(new SectionVersionRef(Guid.NewGuid(), 1), values: Values(("legal", Text("Tampered"))));

        var html = await renderer.RenderSectionAsync(Theme.Default, definition, instance, Context);

        html.ShouldContain("Regulated disclosure");
        html.ShouldNotContain("Tampered");
    }
}
