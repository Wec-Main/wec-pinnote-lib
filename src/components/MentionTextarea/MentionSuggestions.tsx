import type { CSSProperties } from "react";
import { getInitials } from "../../utils/format";
import { highlightQuery, type MentionCandidate } from "../../utils/mentions";

interface MentionSuggestionsProps {
  listboxId: string;
  matches: MentionCandidate[];
  query: string;
  activeIndex: number;
  style: CSSProperties;
  onHover: (index: number) => void;
  onChoose: (candidate: MentionCandidate) => void;
}

export function MentionSuggestions({
  listboxId,
  matches,
  query,
  activeIndex,
  style,
  onHover,
  onChoose,
}: MentionSuggestionsProps) {
  return (
    <div
      className="wpn-mention__menu"
      style={style}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="wpn-mention__menu-title">Suggestions</div>
      {matches.length === 0 ? (
        <p className="wpn-mention__empty">No people match “{query}”</p>
      ) : (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Mention a person"
          className="wpn-mention__list"
        >
          {matches.map((candidate, index) => (
            <li
              key={candidate.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={
                index === activeIndex
                  ? "wpn-mention__option wpn-mention__option--active"
                  : "wpn-mention__option"
              }
              onMouseEnter={() => onHover(index)}
              onClick={() => onChoose(candidate)}
            >
              {candidate.avatarUrl ? (
                <img className="wpn-mention__avatar" src={candidate.avatarUrl} alt="" />
              ) : (
                <span className="wpn-mention__avatar wpn-mention__avatar--fallback">
                  {getInitials(candidate.name)}
                </span>
              )}
              <span className="wpn-mention__copy">
                <span className="wpn-mention__name">
                  {highlightQuery(candidate.name, query).map((part, partIndex) =>
                    part.highlighted ? <strong key={partIndex}>{part.text}</strong> : part.text,
                  )}
                </span>
                {candidate.email ? (
                  <span className="wpn-mention__email">{candidate.email}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="wpn-mention__footer" aria-hidden="true">
        <kbd>↑</kbd>
        <kbd>↓</kbd> navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> dismiss
      </div>
    </div>
  );
}
