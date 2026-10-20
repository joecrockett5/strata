using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Strata.Domain.Media;
using Strata.Domain.SectionTypes;
using Strata.Domain.Sites;
using Strata.Domain.Templates;
using Strata.Infrastructure.Identity;

namespace Strata.Infrastructure.Persistence;

public sealed class StrataDbContext(DbContextOptions<StrataDbContext> options)
    : IdentityDbContext<StrataUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<SectionType> SectionTypes => Set<SectionType>();
    public DbSet<SectionTypeVersion> SectionTypeVersions => Set<SectionTypeVersion>();
    public DbSet<StarterTemplate> StarterTemplates => Set<StarterTemplate>();
    public DbSet<StarterTemplateVersion> StarterTemplateVersions => Set<StarterTemplateVersion>();
    public DbSet<ThemePreset> ThemePresets => Set<ThemePreset>();
    public DbSet<Site> Sites => Set<Site>();
    public DbSet<PublishedSiteVersion> PublishedSiteVersions => Set<PublishedSiteVersion>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<ContactSubmission> ContactSubmissions => Set<ContactSubmission>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(StrataDbContext).Assembly);
    }
}
