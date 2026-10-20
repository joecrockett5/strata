using System.Net;
using Strata.Api.Tests.Infrastructure;
using Strata.Domain.Content;
using static Strata.Testing.Content;

namespace Strata.Api.Tests.Publishing;

/// <summary>A site with a hero (required image) on Home and a contact form on About.</summary>
public sealed record PublishableSite(OwnerApi Owner, SiteResult Site, Guid HeroId, Guid ContactId, Guid AboutId);

public static class Publishing
{
    public static SectionDefinition Hero { get; } = Section(
        Heading("h", TextSlot("headline", "Welcome"), level: 1),
        ImageNode("i", ImageSlot("photo", alt: "", required: true)));

    public static SectionDefinition ContactSection { get; } = Section(
        Heading("h", TextSlot("title", "Get in touch"), level: 1),
        new ContactFormNode { Id = "f", SubmitLabel = TextSlot("submit", "Send"), SuccessMessage = TextSlot("thanks", "Thanks — we'll reply soon.") });

    public static async Task<PublishableSite> CreateAsync(DesignerApi designer, OwnerApi owner, string headline = "Plan with confidence", Guid? photo = null, string alt = "")
    {
        var hero = await designer.PublishedSectionAsync("Hero", Hero);
        var contact = await designer.PublishedSectionAsync("Contact", ContactSection);
        var site = await owner.CreateSiteAsync();

        var heroInstance = Instance(hero, values: Values(("headline", Text(headline)), ("photo", Image(photo, alt))));
        var contactInstance = Instance(contact);
        var about = Page("About", "about", contactInstance) with { Seo = new PageSeo("About us | Test Firm", "Who we are.") };
        using var save = await owner.SaveAsync(site, d => d with { Pages = [d.Pages[0] with { Sections = [heroInstance] }, about] });
        await save.ShouldHaveStatusAsync(HttpStatusCode.OK);
        return new PublishableSite(owner, await owner.GetSiteAsync(site.Id), heroInstance.Id, contactInstance.Id, about.Id);
    }
}
