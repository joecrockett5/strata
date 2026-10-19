import type { NavNode } from "@strata/schema";
import { useSectionRenderState } from "../RenderState";
import type { NodeProps } from "./NodeView";

export function NavView({ scope }: NodeProps<NavNode>) {
  const { context } = useSectionRenderState();
  const { site } = context;
  const listId = `nav-${scope.instanceId}`;

  return (
    <nav className="st-nav" aria-label="Main">
      <a className="st-nav__brand" href={site.homeHref}>
        {site.logo?.mediaId ? (
          <img
            className="st-nav__logo"
            src={`${context.mediaBase}${site.logo.mediaId}`}
            alt={site.logo.alt}
          />
        ) : null}
        <span className="st-nav__name">{site.firmName}</span>
      </a>
      <button className="st-nav__toggle" type="button" aria-expanded="false" aria-controls={listId}>
        Menu
      </button>
      <ul className="st-nav__links" id={listId}>
        {site.nav.map((link) => (
          <li key={link.pageId}>
            <a href={link.href} aria-current={link.current ? "page" : undefined}>
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
