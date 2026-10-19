using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Strata.Domain.Content;
using Strata.Rendering.Components;

namespace Strata.Rendering;

/// <summary>
/// Renders site content to static HTML with Razor components (no Blazor runtime on the page).
/// Output matches the React renderer in @strata/renderer; see the parity tests.
/// </summary>
public sealed class StrataRenderer(IServiceProvider services, ILoggerFactory loggerFactory)
{
    public StrataRenderer()
        : this(new ServiceCollection().BuildServiceProvider(), NullLoggerFactory.Instance)
    {
    }

    /// <summary>A section inside the theme root (what parity fixtures of kind "section" render).</summary>
    public Task<string> RenderSectionAsync(Theme theme, SectionDefinition definition, SectionInstance instance, RenderContext context)
    {
        RenderFragment section = builder =>
        {
            builder.OpenComponent<SectionView>(0);
            builder.AddComponentParameter(1, nameof(SectionView.Definition), definition);
            builder.AddComponentParameter(2, nameof(SectionView.Instance), instance);
            builder.AddComponentParameter(3, nameof(SectionView.Context), context);
            builder.CloseComponent();
        };

        return RenderAsync<SiteRoot>(new Dictionary<string, object?>
        {
            [nameof(SiteRoot.Theme)] = theme,
            [nameof(SiteRoot.ChildContent)] = section,
        });
    }

    /// <summary>A whole page body (skip link, header, main, footer) inside the theme root.</summary>
    public Task<string> RenderPageAsync(SiteDocument document, Guid pageId, IReadOnlyDictionary<string, SectionDefinition> definitions, RenderContext context) =>
        RenderAsync<PageView>(new Dictionary<string, object?>
        {
            [nameof(PageView.Document)] = document,
            [nameof(PageView.PageId)] = pageId,
            [nameof(PageView.Definitions)] = definitions,
            [nameof(PageView.Context)] = context,
        });

    public async Task<string> RenderAsync<TComponent>(IDictionary<string, object?> parameters)
        where TComponent : IComponent
    {
        await using var renderer = new HtmlRenderer(services, loggerFactory);
        return await renderer.Dispatcher.InvokeAsync(async () =>
        {
            var output = await renderer.RenderComponentAsync<TComponent>(ParameterView.FromDictionary(parameters));
            return output.ToHtmlString();
        });
    }
}
