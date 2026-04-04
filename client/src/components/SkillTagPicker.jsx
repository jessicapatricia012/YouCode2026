import { SKILL_TAGS, toggleSkillTag } from '../skillTags.js';
import './SkillTagPicker.css';

export default function SkillTagPicker({ value, onChange, disabled, idPrefix = 'skill' }) {
  return (
    <div className="skill-tag-picker" role="group" aria-label="Skill tags">
      <div className="skill-tag-picker__grid">
        {SKILL_TAGS.map((t) => {
          const on = value.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              id={`${idPrefix}-${t.id}`}
              className={`skill-tag-picker__chip${on ? ' skill-tag-picker__chip--on' : ''}`}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(toggleSkillTag(value, t.id))}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
