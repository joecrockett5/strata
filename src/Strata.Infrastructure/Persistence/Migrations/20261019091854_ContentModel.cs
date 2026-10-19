using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Strata.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ContentModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "media_assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    byte_size = table.Column<long>(type: "bigint", nullable: false),
                    width = table.Column<int>(type: "integer", nullable: false),
                    height = table.Column<int>(type: "integer", nullable: false),
                    storage_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_media_assets", x => x.id);
                    table.ForeignKey(
                        name: "fk_media_assets_asp_net_users_owner_id",
                        column: x => x.owner_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "section_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    category = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    draft = table.Column<string>(type: "jsonb", nullable: false),
                    draft_revision = table.Column<long>(type: "bigint", nullable: false),
                    published_draft_revision = table.Column<long>(type: "bigint", nullable: true),
                    latest_version = table.Column<int>(type: "integer", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    archived_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_section_types", x => x.id);
                    table.ForeignKey(
                        name: "fk_section_types_asp_net_users_created_by",
                        column: x => x.created_by,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "theme_presets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    theme = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_theme_presets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "starter_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    thumbnail_media_id = table.Column<Guid>(type: "uuid", nullable: true),
                    draft = table.Column<string>(type: "jsonb", nullable: false),
                    draft_revision = table.Column<long>(type: "bigint", nullable: false),
                    published_draft_revision = table.Column<long>(type: "bigint", nullable: true),
                    latest_version = table.Column<int>(type: "integer", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    archived_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_starter_templates", x => x.id);
                    table.ForeignKey(
                        name: "fk_starter_templates_asp_net_users_created_by",
                        column: x => x.created_by,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_starter_templates_media_assets_thumbnail_media_id",
                        column: x => x.thumbnail_media_id,
                        principalTable: "media_assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "section_type_versions",
                columns: table => new
                {
                    section_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    category = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    definition = table.Column<string>(type: "jsonb", nullable: false),
                    published_by = table.Column<Guid>(type: "uuid", nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_section_type_versions", x => new { x.section_type_id, x.version });
                    table.ForeignKey(
                        name: "fk_section_type_versions_asp_net_users_published_by",
                        column: x => x.published_by,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_section_type_versions_section_types_section_type_id",
                        column: x => x.section_type_id,
                        principalTable: "section_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "starter_template_versions",
                columns: table => new
                {
                    template_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    thumbnail_media_id = table.Column<Guid>(type: "uuid", nullable: true),
                    document = table.Column<string>(type: "jsonb", nullable: false),
                    published_by = table.Column<Guid>(type: "uuid", nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_starter_template_versions", x => new { x.template_id, x.version });
                    table.ForeignKey(
                        name: "fk_starter_template_versions_asp_net_users_published_by",
                        column: x => x.published_by,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_starter_template_versions_starter_templates_template_id",
                        column: x => x.template_id,
                        principalTable: "starter_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "published_site_versions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version_number = table.Column<int>(type: "integer", nullable: false),
                    snapshot = table.Column<string>(type: "jsonb", nullable: false),
                    source_draft_revision = table.Column<long>(type: "bigint", nullable: false),
                    published_by = table.Column<Guid>(type: "uuid", nullable: false),
                    published_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_published_site_versions", x => x.id);
                    table.ForeignKey(
                        name: "fk_published_site_versions_asp_net_users_published_by",
                        column: x => x.published_by,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    slug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    draft = table.Column<string>(type: "jsonb", nullable: false),
                    draft_revision = table.Column<long>(type: "bigint", nullable: false),
                    source_template_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_template_version = table.Column<int>(type: "integer", nullable: true),
                    current_published_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    published_draft_revision = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sites", x => x.id);
                    table.ForeignKey(
                        name: "fk_sites_asp_net_users_owner_id",
                        column: x => x.owner_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_sites_published_site_versions_current_published_version_id",
                        column: x => x.current_published_version_id,
                        principalTable: "published_site_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_sites_starter_templates_source_template_id",
                        column: x => x.source_template_id,
                        principalTable: "starter_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "ix_media_assets_owner_id",
                table: "media_assets",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "ix_published_site_versions_published_by",
                table: "published_site_versions",
                column: "published_by");

            migrationBuilder.CreateIndex(
                name: "ix_published_site_versions_site_id_version_number",
                table: "published_site_versions",
                columns: new[] { "site_id", "version_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_section_type_versions_published_by",
                table: "section_type_versions",
                column: "published_by");

            migrationBuilder.CreateIndex(
                name: "ix_section_types_category",
                table: "section_types",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "ix_section_types_created_by",
                table: "section_types",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "ix_sites_current_published_version_id",
                table: "sites",
                column: "current_published_version_id");

            migrationBuilder.CreateIndex(
                name: "ix_sites_owner_id",
                table: "sites",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "ix_sites_slug",
                table: "sites",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sites_source_template_id",
                table: "sites",
                column: "source_template_id");

            migrationBuilder.CreateIndex(
                name: "ix_starter_template_versions_published_by",
                table: "starter_template_versions",
                column: "published_by");

            migrationBuilder.CreateIndex(
                name: "ix_starter_templates_created_by",
                table: "starter_templates",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "ix_starter_templates_thumbnail_media_id",
                table: "starter_templates",
                column: "thumbnail_media_id");

            migrationBuilder.CreateIndex(
                name: "ix_theme_presets_name",
                table: "theme_presets",
                column: "name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_published_site_versions_sites_site_id",
                table: "published_site_versions",
                column: "site_id",
                principalTable: "sites",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_published_site_versions_sites_site_id",
                table: "published_site_versions");

            migrationBuilder.DropTable(
                name: "section_type_versions");

            migrationBuilder.DropTable(
                name: "starter_template_versions");

            migrationBuilder.DropTable(
                name: "theme_presets");

            migrationBuilder.DropTable(
                name: "section_types");

            migrationBuilder.DropTable(
                name: "sites");

            migrationBuilder.DropTable(
                name: "published_site_versions");

            migrationBuilder.DropTable(
                name: "starter_templates");

            migrationBuilder.DropTable(
                name: "media_assets");
        }
    }
}
