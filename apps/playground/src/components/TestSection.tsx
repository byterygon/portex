import { useState } from 'react';
import type { ReactNode } from 'react';

type Props = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function TestSection({ id, title, description, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="test-section" id={id}>
      <div className="test-section-header" onClick={() => setCollapsed(!collapsed)}>
        <h2>
          <span className="collapse-icon">{collapsed ? '\u25B6' : '\u25BC'}</span>
          {title}
        </h2>
        <p className="test-section-desc">{description}</p>
      </div>
      {!collapsed && <div className="test-section-body">{children}</div>}
    </section>
  );
}
