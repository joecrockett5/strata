using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Strata.Domain.Media;
using Strata.Domain.Templates;
using Strata.Infrastructure.Identity;

namespace Strata.Infrastructure.Persistence.Configurations;

internal sealed class StarterTemplateConfiguration : IEntityTypeConfiguration<StarterTemplate>
{
    public void Configure(EntityTypeBuilder<StarterTemplate> builder)
    {
        builder.ToTable("starter_templates");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(120);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.Draft).HasContentJson();
        builder.Property(x => x.DraftRevision).IsConcurrencyToken();
        builder.HasOne<StrataUser>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<MediaAsset>().WithMany().HasForeignKey(x => x.ThumbnailMediaId).OnDelete(DeleteBehavior.SetNull);
        builder.HasMany(x => x.Versions).WithOne().HasForeignKey(v => v.TemplateId).OnDelete(DeleteBehavior.Restrict);
        builder.Navigation(x => x.Versions).HasField("versions").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(x => x.IsArchived);
        builder.Ignore(x => x.HasUnpublishedChanges);
    }
}

internal sealed class StarterTemplateVersionConfiguration : IEntityTypeConfiguration<StarterTemplateVersion>
{
    public void Configure(EntityTypeBuilder<StarterTemplateVersion> builder)
    {
        builder.ToTable("starter_template_versions");
        builder.HasKey(x => new { x.TemplateId, x.Version });
        builder.Property(x => x.Name).HasMaxLength(120);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.Document).HasContentJson();
        builder.HasOne<StrataUser>().WithMany().HasForeignKey(x => x.PublishedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ThemePresetConfiguration : IEntityTypeConfiguration<ThemePreset>
{
    public void Configure(EntityTypeBuilder<ThemePreset> builder)
    {
        builder.ToTable("theme_presets");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(80);
        builder.HasIndex(x => x.Name).IsUnique();
        builder.Property(x => x.Theme).HasContentJson();
    }
}
