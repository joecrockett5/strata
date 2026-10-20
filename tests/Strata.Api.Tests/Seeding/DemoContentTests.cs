using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Strata.Api.Tests.Infrastructure;
using Strata.Infrastructure.Identity;
using Strata.Infrastructure.Persistence;
using Strata.Infrastructure.Seeding.Demo;

namespace Strata.Api.Tests.Seeding;

public sealed class DemoContentTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task SeedAsync()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<StrataUser>>();
        var designer = await users.FindByEmailAsync(StrataApiFactory.Designer.Email);
        var owner = await users.FindByEmailAsync(StrataApiFactory.Owner.Email);
        await scope.ServiceProvider.GetRequiredService<DemoContentSeeder>().SeedAsync(designer!.Id, owner!.Id, Ct);
    }

    [Fact]
    public async Task Demo_site_is_published_and_the_template_is_ready_to_use()
    {
        await SeedAsync();
        await SeedAsync(); // idempotent

        using var anonymous = AnonymousClient();
        using var home = await anonymous.Http.GetAsync(new Uri($"/s/{HarborPine.DemoSiteSlug}/", UriKind.Relative), Ct);
        await home.ShouldHaveStatusAsync(HttpStatusCode.OK);
        var html = WebUtility.HtmlDecode(await home.Content.ReadAsStringAsync(Ct));
        html.ShouldContain("<title>Harbor & Pine Wealth Partners | Independent financial advice</title>");
        html.ShouldContain("Plan with confidence");
        html.ShouldContain("Investing involves risk"); // locked disclosure in the footer
        foreach (var page in new[] { "about", "services", "contact" })
        {
            using var response = await anonymous.Http.GetAsync(new Uri($"/s/{HarborPine.DemoSiteSlug}/{page}", UriKind.Relative), Ct);
            await response.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        // Generated placeholder images are served.
        var image = System.Text.RegularExpressions.Regex.Match(html, "src=\"(/media/[0-9a-f-]+)\"").Groups[1].Value;
        using var media = await anonymous.Http.GetAsync(new Uri(image, UriKind.Relative), Ct);
        media.Content.Headers.ContentType!.MediaType.ShouldBe("image/png");

        await using (var scope = Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<StrataDbContext>();
            (await db.StarterTemplates.CountAsync(t => t.Name == HarborPine.TemplateName, Ct)).ShouldBe(1);
        }

        // The owner sees the demo site; the template is offered to new sites and passes publish checks.
        var owner = await OwnerAsync();
        var sites = await owner.Http.GetFromJsonAsync<JsonElement[]>("/api/sites", Ct);
        var demo = sites!.Single(s => s.GetProperty("slug").GetString() == HarborPine.DemoSiteSlug);
        demo.GetProperty("isPublished").GetBoolean().ShouldBeTrue();

        var templates = await owner.Http.GetFromJsonAsync<JsonElement[]>("/api/templates/published", Ct);
        var template = templates!.Single(t => t.GetProperty("name").GetString() == HarborPine.TemplateName);
        template.GetProperty("pageCount").GetInt32().ShouldBe(4);

        var site = await owner.CreateSiteAsync(template.GetProperty("id").GetGuid());
        var checks = await owner.Http.GetFromJsonAsync<JsonElement>($"/api/sites/{site.Id}/publish-checks", Ct);
        checks.GetProperty("errors").GetInt32().ShouldBe(0);
        checks.GetProperty("warnings").GetInt32().ShouldBe(0);
    }
}
