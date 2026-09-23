import { Icon } from "../primitives";

export const EPICFLOW_PAGE_SIZE = 10;

interface ShowMoreButtonProps {
  remaining: number;
  onClick: () => void;
}

export function ShowMoreButton({ remaining, onClick }: ShowMoreButtonProps) {
  if (remaining <= 0) {
    return null;
  }
  return (
    <button type="button" className="wpn-epicflow-show-more" onClick={onClick}>
      <Icon name="chevronDown" className="wpn-epicflow-show-more__icon" />
      Show more
      <span className="wpn-epicflow-show-more__count">{remaining}</span>
    </button>
  );
}
