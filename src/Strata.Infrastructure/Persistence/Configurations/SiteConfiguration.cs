using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Strata.Domain.Sites;
using Strata.Domain.Templates;
using Strata.Infrastructure.Identity;

namespace Strata.Infrastructure.Persistence.Configurations;

internal sealed class SiteConfiguration : IEntityTypeConfiguration<Site>
{
    public void Configure(EntityTypeBuilder<Site> builder)
    {
        builder.ToTable("sites");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(120);
        builder.Property(x => x.Slug).HasMaxLength(40);
        builder.HasIndex(x => x.Slug).IsUnique();
        builder.HasIndex(x => x.OwnerId);
        builder.Property(x => x.Draft).HasContentJson();
        builder.Property(x => x.DraftRevision).IsConcurrencyToken();
        builder.HasOne<StrataUser>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<StarterTemplate>().WithMany().HasForeignKey(x => x.SourceTemplateId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<PublishedSiteVersion>().WithMany().HasForeignKey(x => x.CurrentPublishedVersionId).OnDelete(DeleteBehavior.SetNull);
        builder.Ignore(x => x.HasUnpublishedChanges);
    }
}

internal sealed class PublishedSiteVersionConfiguration : IEntityTypeConfiguration<PublishedSiteVersion>
{
    public void Configure(EntityTypeBuilder<PublishedSiteVersion> builder)
    {
        builder.ToTable("published_site_versions");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.SiteId, x.VersionNumber }).IsUnique();
        builder.Property(x => x.Snapshot).HasContentJson();
        builder.HasOne<Site>().WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<StrataUser>().WithMany().HasForeignKey(x => x.PublishedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ContactSubmissionConfiguration : IEntityTypeConfiguration<ContactSubmission>
{
    public void Configure(EntityTypeBuilder<ContactSubmission> builder)
    {
        builder.ToTable("contact_submissions");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.SiteId, x.CreatedAt });
        builder.Property(x => x.Name).HasMaxLength(100);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(40);
        builder.Property(x => x.Message).HasMaxLength(4000);
        builder.HasOne<Site>().WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<PublishedSiteVersion>().WithMany().HasForeignKey(x => x.PublishedVersionId).OnDelete(DeleteBehavior.Cascade);
    }
}
