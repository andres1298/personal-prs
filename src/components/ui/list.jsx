import Icon from './icon';

// Inset grouped list, as in iOS Settings.
export function List({ header, footer, children, className = '', ...rest }) {
  return <section className={`list-section ${className}`} {...rest}>
    {header && <h3 className="list-header">{header}</h3>}
    <div className="list">{children}</div>
    {footer && <p className="list-footer">{footer}</p>}
  </section>;
}

// A row is a button when it has onClick, otherwise a plain container.
export function Row({ as: Tag = 'div', leading, title, subtitle, detail, chevron, onClick, disabled, className = '', children, ...rest }) {
  const content = <>
    {leading && <span className="row-leading">{leading}</span>}
    <span className="row-body">
      <span className="row-text">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-subtitle">{subtitle}</span>}
      </span>
      {detail != null && <span className="row-detail">{detail}</span>}
      {children}
      {chevron && <Icon name="chevronRight" className="row-chevron" weight={2.4} />}
    </span>
  </>;
  if (onClick) {
    return <button type="button" className={`row row-button ${className}`} onClick={onClick} disabled={disabled} {...rest}>{content}</button>;
  }
  return <Tag className={`row ${className}`} {...rest}>{content}</Tag>;
}
