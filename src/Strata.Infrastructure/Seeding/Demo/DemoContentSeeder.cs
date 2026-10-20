using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Strata.Domain.Content;
using Strata.Domain.Media;
using Strata.Domain.SectionTypes;
using Strata.Domain.Sites;
using Strata.Domain.Templates;
using Strata.Infrastructure.Persistence;

namespace Strata.Infrastructure.Seeding.Demo;

/// <summary>
/// Seeds the Harbor &amp; Pine section types (published v1), the starter template (published v1)
/// and a published demo site owned by the seeded site owner. Runs once: it does nothing when the
/// template already exists.
/// </summary>
public sealed partial class DemoContentSeeder(StrataDbContext db, IFileStorage storage, TimeProvider clock, ILogger<DemoContentSeeder> logger)
{
    public async Task SeedAsync(Guid designerId, Guid? ownerId, CancellationToken cancellationToken = default)
    {
        if (await db.StarterTemplates.AnyAsync(t => t.Name == HarborPine.TemplateName, cancellationToken))
        {
            return;
        }

        var now = clock.GetUtcNow();
        var images = new HarborPine.Images(
            Logo: await SaveImageAsync(designerId, "harbor-pine-logo.png", PlaceholderImages.Logo(), 240, 240, now, cancellationToken),
            Hero: await SaveImageAsync(designerId, "harbour-at-dawn.png", PlaceholderImages.Harbour(), 1600, 900, now, cancellationToken),
            About: await SaveImageAsync(designerId, "pine-hills.png", PlaceholderImages.Hills(), 1200, 900, now, cancellationToken),
            Team:
            [
                await SaveImageAsync(designerId, "portrait-1.png", PlaceholderImages.Portrait(0), 600, 600, now, cancellationToken),
                await SaveImageAsync(designerId, "portrait-2.png", PlaceholderImages.Portrait(1), 600, 600, now, cancellationToken),
                await SaveImageAsync(designerId, "portrait-3.png", PlaceholderImages.Portrait(2), 600, 600, now, cancellationToken),
            ]);

        var specs = HarborPine.Sections(images);
        var refs = new Dictionary<string, SectionVersionRef>(StringComparer.Ordinal);
        foreach (var spec in specs)
        {
            var type = SectionType.Create(spec.Name, spec.Category, spec.Definition, designerId, now);
            refs[spec.Key] = type.PublishVersion(designerId, now).Ref;
            db.SectionTypes.Add(type);
        }

        var document = HarborPine.TemplateDocument(refs, images);
        var problems = HarborPine.Verify(specs, refs, document, images);
        if (problems.Count > 0)
        {
            throw new InvalidOperationException("Demo content is invalid:\n" + string.Join('\n', problems));
        }

        var template = StarterTemplate.Create(HarborPine.TemplateName, HarborPine.TemplateDescription, document, designerId, now);
        template.UpdateDraft(HarborPine.TemplateName, HarborPine.TemplateDescription, images.Hero, document, template.DraftRevision, now);
        var templateVersion = template.PublishVersion(designerId, now);
        db.StarterTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);

        if (ownerId is { } owner && !await db.Sites.AnyAsync(s => s.Slug == HarborPine.DemoSiteSlug, cancellationToken))
        {
            // Exactly what "create a site from this template" does: an independent copy.
            var site = Site.Create(owner, HarborPine.FirmName, HarborPine.DemoSiteSlug, templateVersion.Document, template.Id, templateVersion.Version, now);
            db.Sites.Add(site);
            await db.SaveChangesAsync(cancellationToken);

            var definitions = specs.ToDictionary(s => refs[s.Key].ToString(), s => s.Definition, StringComparer.Ordinal);
            var published = PublishedSiteVersion.Create(site, 1, new PublishedSnapshot(site.Draft, definitions), owner, now);
            db.PublishedSiteVersions.Add(published);
            site.MarkPublished(published);
            await db.SaveChangesAsync(cancellationToken);
        }

        LogSeeded(logger, specs.Count, HarborPine.DemoSiteSlug);
    }

    private async Task<Guid> SaveImageAsync(Guid ownerId, string fileName, byte[] png, int width, int height, DateTimeOffset now, CancellationToken cancellationToken)
    {
        using var stream = new MemoryStream(png);
        var key = await storage.SaveAsync(stream, ".png", cancellationToken);
        var asset = MediaAsset.Create(ownerId, fileName, "image/png", png.Length, width, height, key, now);
        db.MediaAssets.Add(asset);
        return asset.Id;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Seeded demo content: {SectionTypes} section types, a starter template and the site '{Slug}'")]
    private static partial void LogSeeded(ILogger logger, int sectionTypes, string slug);
}
