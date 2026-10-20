using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Strata.Api.Tests.Infrastructure;
using Strata.Domain.Content;
using Strata.Domain.Publishing;
using static Strata.Testing.Content;

namespace Strata.Api.Tests.Publishing;

public sealed class PublishingApiTests(PostgresFixture postgres) : ApiTestBase(postgres)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Task<HttpResponseMessage> PublishAsync(OwnerApi owner, Guid siteId) =>
        owner.Http.PostAsync(new Uri($"/api/sites/{siteId}/publish", UriKind.Relative), null, Ct);

    private static async Task<HttpResponseMessage> ReplaceDraftAsync(OwnerApi owner, Guid siteId, Func<SiteDocument, SiteDocument> change)
    {
        var site = await owner.GetSiteAsync(siteId);
        return await owner.SaveAsync(site, change);
    }

    [Fact]
    public async Task Checks_report_errors_that_block_publishing_until_fixed()
    {
        var owner = await OwnerAsync();
        var photo = await owner.UploadPngAsync();
        var site = await Publishing.CreateAsync(await DesignerAsync(), owner, photo: photo, alt: "");

        var checks = await owner.Http.GetFromJsonAsync<JsonElement>($"/api/sites/{site.Site.Id}/publish-checks", Ct);
        checks.GetProperty("errors").GetInt32().ShouldBe(1);
        var issue = checks.GetProperty("issues")[0];
        issue.GetProperty("severity").GetString().ShouldBe("error");
        issue.GetProperty("code").GetString().ShouldBe(PublishIssueCodes.MissingAlt);
        issue.GetProperty("instanceId").GetGuid().ShouldBe(site.HeroId);
        issue.GetProperty("pageId").GetGuid().ShouldBe(site.Site.Document.Pages[0].Id);

        using (var blocked = await PublishAsync(owner, site.Site.Id))
        {
            await blocked.ShouldBeRejectedWithAsync(PublishIssueCodes.MissingAlt);
        }

        using (var fix = await ReplaceDraftAsync(owner, site.Site.Id, d => d.ReplaceInstance(site.HeroId, i => i with { Values = Values(("photo", Image(photo, "Our office"))) })))
        {
            await fix.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        using var published = await PublishAsync(owner, site.Site.Id);
        await published.ShouldHaveStatusAsync(HttpStatusCode.Created);
        var body = await published.ReadJsonAsync();
        body.GetProperty("version").GetInt32().ShouldBe(1);
        body.GetProperty("url").GetString().ShouldBe($"/s/{site.Site.Slug}/");

        var detail = await owner.Http.GetFromJsonAsync<JsonElement>($"/api/sites/{site.Site.Id}", Ct);
        detail.GetProperty("isPublished").GetBoolean().ShouldBeTrue();
        detail.GetProperty("hasUnpublishedChanges").GetBoolean().ShouldBeFalse();
    }

    [Fact]
    public async Task Public_pages_serve_the_published_snapshot_until_the_next_publish()
    {
        var owner = await OwnerAsync();
        var site = await Publishing.CreateAsync(await DesignerAsync(), owner, headline: "Version one", photo: await owner.UploadPngAsync(), alt: "Office");
        using (var first = await PublishAsync(owner, site.Site.Id))
        {
            await first.ShouldHaveStatusAsync(HttpStatusCode.Created);
        }

        using (var edit = await ReplaceDraftAsync(owner, site.Site.Id, d => d.ReplaceInstance(site.HeroId, i => i with { Values = new Dictionary<string, SlotValue>(i.Values) { ["headline"] = Text("Version two") } })))
        {
            await edit.ShouldHaveStatusAsync(HttpStatusCode.OK);
        }

        using var anonymous = AnonymousClient();
        var before = await anonymous.Http.GetStringAsync(new Uri($"/s/{site.Site.Slug}/", UriKind.Relative), Ct);
        before.ShouldContain("Version one");
        before.ShouldNotContain("Version two");

        using (var second = await PublishAsync(owner, site.Site.Id))
        {
            await second.ShouldHaveStatusAsync(HttpStatusCode.Created);
            (await second.ReadJsonAsync()).GetProperty("version").GetInt32().ShouldBe(2);
        }

        var after = await anonymous.Http.GetStringAsync(new Uri($"/s/{site.Site.Slug}/", UriKind.Relative), Ct);
        after.ShouldContain("Version two");
    }

    [Fact]
    public async Task Public_pages_have_seo_metadata_caching_and_security_headers()
    {
        var owner = await OwnerAsync();
        var site = await Publishing.CreateAsync(await DesignerAsync(), owner, photo: await owner.UploadPngAsync(), alt: "Office");
        using (var publish = await PublishAsync(owner, site.Site.Id))
        {
            await publish.ShouldHaveStatusAsync(HttpStatusCode.Created);
        }

        using var anonymous = AnonymousClient();
        using var response = await anonymous.Http.GetAsync(new Uri($"/s/{site.Site.Slug}/about", UriKind.Relative), Ct);
        await response.ShouldHaveStatusAsync(HttpStatusCode.OK);
        var html = await response.Content.ReadAsStringAsync(Ct);
        html.ShouldStartWith("<!DOCTYPE html>");
        html.ShouldContain("<title>About us | Test Firm</title>");
        html.ShouldContain("<meta name=\"description\" content=\"Who we are.\"");
        html.ShouldContain($"<link rel=\"canonical\" href=\"http://localhost/s/{site.Site.Slug}/about\"");
        html.ShouldContain("<meta property=\"og:title\" content=\"About us | Test Firm\"");
        html.ShouldContain("href=\"/site-assets/site.css\"");
        html.ShouldContain("Get in touch");
        html.ShouldContain($"action=\"/s/{site.Site.Slug}/_contact\"");
        response.Headers.GetValues("Content-Security-Policy").Single().ShouldContain("default-src 'self'");
        response.Headers.CacheControl!.NoCache.ShouldBeTrue();

        var etag = response.Headers.ETag!;
        using var conditional = new HttpRequestMessage(HttpMethod.Get, $"/s/{site.Site.Slug}/about");
        conditional.Headers.IfNoneMatch.Add(etag);
        using var notModified = await anonymous.Http.SendAsync(conditional, Ct);
        notModified.StatusCode.ShouldBe(HttpStatusCode.NotModified);

        var sitemap = await anonymous.Http.GetStringAsync(new Uri($"/s/{site.Site.Slug}/sitemap.xml", UriKind.Relative), Ct);
        sitemap.ShouldContain($"<loc>http://localhost/s/{site.Site.Slug}/</loc>");
        sitemap.ShouldContain($"<loc>http://localhost/s/{site.Site.Slug}/about</loc>");
        var robots = await anonymous.Http.GetStringAsync(new Uri($"/s/{site.Site.Slug}/robots.txt", UriKind.Relative), Ct);
        robots.ShouldContain($"Sitemap: http://localhost/s/{site.Site.Slug}/sitemap.xml");
    }

    [Fact]
    public async Task Missing_pages_and_unpublished_sites_get_a_styled_404()
    {
        var owner = await OwnerAsync();
        var site = await Publishing.CreateAsync(await DesignerAsync(), owner, photo: await owner.UploadPngAsync(), alt: "Office");
        using var anonymous = AnonymousClient();

        using (var unpublished = await anonymous.Http.GetAsync(new Uri($"/s/{site.Site.Slug}/", UriKind.Relative), Ct))
        {
            unpublished.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await unpublished.Content.ReadAsStringAsync(Ct)).ShouldContain("We couldn’t find that page");
        }

        using (var publish = await PublishAsync(owner, site.Site.Id))
        {
            await publish.ShouldHaveStatusAsync(HttpStatusCode.Created);
        }

        using var missing = await anonymous.Http.GetAsync(new Uri($"/s/{site.Site.Slug}/no-such-page", UriKind.Relative), Ct);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var html = await missing.Content.ReadAsStringAsync(Ct);
        html.ShouldContain("st-site");
        html.ShouldContain($"href=\"/s/{site.Site.Slug}/\"");
    }

    [Fact]
    public async Task Sites_are_also_served_on_their_own_localhost_subdomain()
    {
        var owner = await OwnerAsync();
        var site = await Publishing.CreateAsync(await DesignerAsync(), owner, photo: await owner.UploadPngAsync(), alt: "Office");
        using (var publish = await PublishAsync(owner, site.Site.Id))
        {
            await publish.ShouldHaveStatusAsync(HttpStatusCode.Created);
        }

        using var anonymous = AnonymousClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/about");
        request.Headers.Host = $"{site.Site.Slug}.localhost";
        using var response = await anonymous.Http.SendAsync(request, Ct);

        await response.ShouldHaveStatusAsync(HttpStatusCode.OK);
        var html = await response.Content.ReadAsStringAsync(Ct);
        html.ShouldContain($"<link rel=\"canonical\" href=\"http://{site.Site.Slug}.localhost/about\"");
        html.ShouldContain("action=\"/_contact\"");
        html.ShouldNotContain("/s/");
    }

    [Fact]
    public async Task Other_owners_cannot_check_publish_or_read_submissions()
    {
        var owner = await OwnerAsync();
        var site = await Publishing.CreateAsync(await DesignerAsync(), owner, photo: await owner.UploadPngAsync(), alt: "Office");
        var other = await OwnerAsync(StrataApiFactory.OtherOwner);

        using var checks = await other.Http.GetAsync(new Uri($"/api/sites/{site.Site.Id}/publish-checks", UriKind.Relative), Ct);
        using var publish = await PublishAsync(other, site.Site.Id);
        using var submissions = await other.Http.GetAsync(new Uri($"/api/sites/{site.Site.Id}/submissions", UriKind.Relative), Ct);

        checks.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        publish.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        submissions.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await owner.GetSiteAsync(site.Site.Id)).Revision.ShouldBe(site.Site.Revision);
    }
}
