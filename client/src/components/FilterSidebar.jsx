import { Link } from 'react-router-dom';
import {
  EVENT_TYPE_ORDER,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
} from '../eventTypes.js';

export default function FilterSidebar({
  includedTypes,
  onToggleType,
  onSelectAll,
  orgName,
  userEmail,
  userRole,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <h1 className="sidebar__title">ConnectBC</h1>
        <p className="sidebar__subtitle">Nonprofit events across BC · filter by type</p>
        {userEmail && (
          <div className="sidebar__account">
            {userRole && (
              <span
                className={`sidebar__role-badge sidebar__role-badge--${userRole}`}
              >
                {userRole === 'organizer' ? 'Organizer' : 'Visitor'}
              </span>
            )}
            {orgName && (
              <span className="sidebar__org-name" title={orgName}>
                {orgName}
              </span>
            )}
            <span className="sidebar__email" title={userEmail}>
              {userEmail}
            </span>
            {userRole === 'organizer' && (
              <Link to="/organize" className="sidebar__organize-link">
                Manage listings
              </Link>
            )}
            {userRole === 'user' && (
              <Link to="/visitor" className="sidebar__profile-link">
                My Volunteer Profile
              </Link>
            )}
            {onLogout && (
              <button
                type="button"
                className="sidebar__logout"
                onClick={() => onLogout()}
              >
                Log out
              </button>
            )}
          </div>
        )}
      </header>
      <div className="sidebar__filters">
        {EVENT_TYPE_ORDER.map((type) => {
          const on = includedTypes.includes(type);
          return (
            <label
              key={type}
              className={`filter-row ${on ? 'filter-row--active' : ''}`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggleType(type)}
              />
              <span
                className="filter-row__swatch"
                style={{ background: EVENT_TYPE_COLORS[type] }}
              />
              <span className="filter-row__label">{EVENT_TYPE_LABELS[type]}</span>
            </label>
          );
        })}
      </div>
      <button type="button" className="sidebar__all" onClick={onSelectAll}>
        Select all types
      </button>
      <p className="sidebar__hint">
        Uncheck a type to hide it. The map reloads from the API when you change filters.
        {includedTypes.length === 0 && (
          <strong className="sidebar__warn"> Select at least one type to see pins.</strong>
        )}
      </p>
    </aside>
  );
}
