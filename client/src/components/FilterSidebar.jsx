import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EVENT_TYPE_ORDER,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
} from '../eventTypes.js';
import { RADIUS_SLIDER_STEPS_KM, radiusStepLabel } from '../mapRadius.js';

const RADIUS_SLIDER_MAX = RADIUS_SLIDER_STEPS_KM.length - 1;

const SLIDER_COMMIT_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export default function FilterSidebar({
  includedTypes,
  onToggleType,
  onSelectAll,
  radiusStepIndex,
  onRadiusCommit,
  onRadiusOverlayStart,
  onRadiusOverlayMove,
  onRadiusOverlayEnd,
  hasUserLocation,
  orgName,
  userEmail,
  userRole,
  onLogout,
}) {
  const [localRadiusIndex, setLocalRadiusIndex] = useState(radiusStepIndex);
  const radiusSliderRef = useRef(null);
  const radiusPointerActiveRef = useRef(false);
  const radiusKeyboardAdjustRef = useRef(false);
  const localRadiusRef = useRef(radiusStepIndex);

  useEffect(() => {
    setLocalRadiusIndex(radiusStepIndex);
  }, [radiusStepIndex]);

  useEffect(() => {
    localRadiusRef.current = localRadiusIndex;
  }, [localRadiusIndex]);

  function commitRadiusFromInput(input) {
    if (!input || input.disabled) return;
    const v = Number(input.value);
    if (!Number.isFinite(v)) return;
    onRadiusCommit(v);
  }

  useEffect(() => {
    function finishRadiusPointer() {
      if (!radiusPointerActiveRef.current) return;
      radiusPointerActiveRef.current = false;
      const el = radiusSliderRef.current;
      if (!el || el.disabled) return;
      const v = Number(el.value);
      if (Number.isFinite(v)) onRadiusCommit(v);
    }
    window.addEventListener('pointerup', finishRadiusPointer);
    window.addEventListener('pointercancel', finishRadiusPointer);
    return () => {
      window.removeEventListener('pointerup', finishRadiusPointer);
      window.removeEventListener('pointercancel', finishRadiusPointer);
    };
  }, [onRadiusCommit]);

  const displayName =
    (orgName && String(orgName).trim()) || userEmail?.split('@')[0] || '?';
  const avatarLetter = (displayName || userEmail || '?').charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar__body">
        <header className="sidebar__header">
          <h1 className="sidebar__title">ConnectBC</h1>
          <p className="sidebar__subtitle">
            Nonprofit events across BC · filter by type and distance
          </p>
        </header>
        <div className="sidebar__radius">
          <div className="sidebar__radius-header">
            <span className="sidebar__radius-title">Distance from you</span>
            <span className="sidebar__radius-value">{radiusStepLabel(localRadiusIndex)}</span>
          </div>
          <input
            ref={radiusSliderRef}
            type="range"
            className="sidebar__radius-slider"
            min={0}
            max={RADIUS_SLIDER_MAX}
            step={1}
            value={localRadiusIndex}
            disabled={!hasUserLocation}
            aria-valuemin={0}
            aria-valuemax={RADIUS_SLIDER_MAX}
            aria-valuenow={localRadiusIndex}
            aria-label="Maximum distance from your location"
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocalRadiusIndex(v);
              if (
                hasUserLocation &&
                (radiusPointerActiveRef.current || radiusKeyboardAdjustRef.current)
              ) {
                onRadiusOverlayMove(v);
              }
            }}
            onPointerDown={() => {
              if (!hasUserLocation) return;
              radiusPointerActiveRef.current = true;
              onRadiusOverlayStart(localRadiusRef.current);
            }}
            onKeyDown={(e) => {
              if (!hasUserLocation) return;
              if (SLIDER_COMMIT_KEYS.has(e.key)) {
                radiusKeyboardAdjustRef.current = true;
                onRadiusOverlayStart(localRadiusRef.current);
              }
            }}
            onKeyUp={(e) => {
              if (!SLIDER_COMMIT_KEYS.has(e.key)) return;
              radiusKeyboardAdjustRef.current = false;
              commitRadiusFromInput(e.currentTarget);
            }}
            onBlur={() => {
              radiusPointerActiveRef.current = false;
              radiusKeyboardAdjustRef.current = false;
              onRadiusOverlayEnd();
              setLocalRadiusIndex(radiusStepIndex);
            }}
          />
          <div className="sidebar__radius-ticks" aria-hidden>
            <span>BC</span>
            <span>800 km</span>
          </div>
          {!hasUserLocation ? (
            <p className="sidebar__radius-hint">
              Allow browser location to filter by distance. Until then, all distances are shown.
            </p>
          ) : null}
        </div>
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
          Uncheck a type to hide it. Type filters reload from the API; distance is applied on the map
          only.
          {includedTypes.length === 0 && (
            <strong className="sidebar__warn"> Select at least one type to see pins.</strong>
          )}
        </p>
      </div>

      <footer className="sidebar__footer">
        {userEmail ? (
          <>
            <div className="sidebar__user-bar">
              <div className="sidebar__user-avatar" aria-hidden>
                {avatarLetter}
              </div>
              <div className="sidebar__user-meta">
                <span className="sidebar__user-name" title={displayName}>
                  {displayName}
                </span>
                <span className="sidebar__user-email" title={userEmail}>
                  {userEmail}
                </span>
              </div>
              {userRole ? (
                <span
                  className={`sidebar__role-badge sidebar__role-badge--compact sidebar__role-badge--${userRole}`}
                >
                  {userRole === 'organizer' ? 'Org' : 'Visitor'}
                </span>
              ) : null}
            </div>
            <div className="sidebar__user-actions">
              {userRole === 'organizer' && (
                <Link to="/dashboard" className="sidebar__user-action sidebar__user-action--primary">
                  Manage listings
                </Link>
              )}
              {userRole === 'user' && (
                <Link to="/visitor" className="sidebar__user-action sidebar__user-action--profile">
                  Profile
                </Link>
              )}
              {onLogout && (
                <button
                  type="button"
                  className="sidebar__user-action sidebar__user-action--ghost"
                  onClick={() => onLogout()}
                >
                  Log out
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="sidebar__guest-bar">
            <Link to="/login" className="sidebar__guest-link">
              Sign in
            </Link>
            <span className="sidebar__guest-sep" aria-hidden>
              ·
            </span>
            <Link to="/register" className="sidebar__guest-link">
              Register
            </Link>
          </div>
        )}
      </footer>
    </aside>
  );
}
