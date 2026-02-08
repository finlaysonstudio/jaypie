import React from "react";
import { useThemeConfig, useColorMode } from "@docusaurus/theme-common";
import FooterCopyright from "@theme/Footer/Copyright";
import FooterLinkItem from "@theme/Footer/LinkItem";
import ColorModeToggle from "@theme/ColorModeToggle";
import type { Props as FooterLinkItemProps } from "@theme/Footer/LinkItem";

interface FooterLinkColumn {
  title?: string;
  items: FooterLinkItemProps["item"][];
}

function LinkColumn({ title, items }: FooterLinkColumn): React.ReactElement {
  return (
    <div className="col footer__col">
      {title && <div className="footer__title">{title}</div>}
      <ul className="footer__items clean-list">
        {items.map((item, idx) => (
          <li key={idx} className="footer__item">
            <FooterLinkItem item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolsColumn(): React.ReactElement {
  const { colorMode, setColorMode } = useColorMode();

  return (
    <div className="col footer__col">
      <div className="footer__title">Tools</div>
      <ul className="footer__items clean-list">
        <li className="footer__item">
          <div className="footer-color-toggle">
            <ColorModeToggle
              value={colorMode}
              onChange={setColorMode}
              respectPrefersColorScheme={true}
            />
            <span className="footer-toggle-label">
              {colorMode === "dark" ? "Dark" : "Light"}
            </span>
          </div>
        </li>
      </ul>
    </div>
  );
}

function Footer(): React.ReactElement | null {
  const { footer } = useThemeConfig();
  if (!footer) {
    return null;
  }
  const { copyright, links, style } = footer;

  return (
    <footer className={`footer footer--${style}`}>
      <div className="container container-fluid">
        {links && links.length > 0 && (
          <div className="row footer__links">
            {(links as FooterLinkColumn[]).map((column, idx) => (
              <LinkColumn key={idx} title={column.title} items={column.items} />
            ))}
            <ToolsColumn />
          </div>
        )}
        {copyright && (
          <div className="footer__bottom text--center">
            <FooterCopyright copyright={copyright} />
          </div>
        )}
      </div>
    </footer>
  );
}

export default React.memo(Footer);
