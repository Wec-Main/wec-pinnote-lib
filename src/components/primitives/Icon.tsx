import type { ReactElement } from "react";

export type IconName =
  | "search"
  | "plus"
  | "edit"
  | "reset"
  | "redo"
  | "trash"
  | "close"
  | "expand"
  | "collapse"
  | "minimize"
  | "windowMinimize"
  | "chevronDown"
  | "chevronUp"
  | "chevronLeft"
  | "chevronRight"
  | "check"
  | "key"
  | "users"
  | "pen"
  | "editNote"
  | "commentAdd"
  | "annotateCursor"
  | "mapPin"
  | "epic"
  | "flow"
  | "dataModel"
  | "comment"
  | "reply"
  | "history"
  | "refresh"
  | "eye"
  | "eyeOff"
  | "alert"
  | "copy"
  | "settings"
  | "calendar"
  | "tag"
  | "building"
  | "folder"
  | "drag"
  | "download"
  | "upload"
  | "zoomIn"
  | "zoomOut"
  | "layers"
  | "lock"
  | "lockOpen"
  | "logout"
  | "info"
  | "grid"
  | "list"
  | "arrowUpRight"
  | "send"
  | "open"
  | "plug"
  | "sparkles"
  | "stop"
  | "x"
  | "thumbsUp"
  | "thumbsDown"
  | "arrowDown"
  | "archive"
  | "sidebar"
  | "save"
  | "undo"
  | "panelCompact"
  | "panelExpanded"
  | "panelMax"
  | "more"
  | "newChat"
  | "pin";

const PATHS: Record<IconName, ReactElement> = {
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  pin: (
    <>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </>
  ),
  newChat: (
    <>
      <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12.5 14.3 9 15l.7-3.5 8.7-8.9Z" />
    </>
  ),
  panelCompact: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 15h18" />
    </>
  ),
  panelExpanded: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10.5h18" />
    </>
  ),
  panelMax: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 7.5h18" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M7 3v5h8V3M7 21v-7h10v7" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v4M15 3v4" />
      <path d="M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0V7Z" />
      <path d="M12 16v5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M10 3.5 11.6 8a2 2 0 0 0 1.2 1.2L17.5 11l-4.7 1.7a2 2 0 0 0-1.2 1.2L10 18.5l-1.6-4.6a2 2 0 0 0-1.2-1.2L2.5 11l4.7-1.8A2 2 0 0 0 8.4 8L10 3.5Z" />
      <path d="M18 3v4M16 5h4M19 16v3M17.5 17.5h3" />
    </>
  ),
  open: (
    <>
      <path d="M13.5 4.5h6v6" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.8v.3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  reset: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4.5h-4.5" />
    </>
  ),
  redo: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  expand: <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />,
  collapse: <path d="M4 10V5h5M4 14v5h5M20 10V5h-5M20 14v5h-5" />,
  minimize: (
    <>
      <path d="M4 5h16" />
      <path d="m8 11 4 4 4-4" />
    </>
  ),
  windowMinimize: <path d="M5 12h14" />,
  tag: (
    <>
      <path d="M3.6 11.4V4.6a1 1 0 0 1 1-1h6.8a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-6.8 6.8a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" />
      <circle cx="8.1" cy="8.1" r="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3.5V6.5M16 3.5V6.5" />
    </>
  ),
  chevronDown: <path d="m5 9 7 7 7-7" />,
  chevronUp: <path d="m5 15 7-7 7 7" />,
  chevronLeft: <path d="m14 5-7 7 7 7" />,
  chevronRight: <path d="m10 5 7 7-7 7" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.2-8.2" />
      <path d="M17 6h3.5v3.5" />
      <path d="m15 8 2 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9" />
      <path d="M17.5 14.4a5.5 5.5 0 0 1 3 5.6" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  editNote: (
    <>
      <path d="M5 4.5h9.5a1.5 1.5 0 0 1 1.5 1.5v6.2" />
      <path d="M5 4.5v15L8.5 17H16" />
      <path d="M14.6 12.2 20 6.8a1.5 1.5 0 0 0-2.1-2.1l-5.4 5.4-.6 2.7Z" />
      <path d="M8 8.5h4" />
    </>
  ),
  epic: (
    <>
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <path d="M8 9.5h8M8 13h5" />
    </>
  ),
  flow: (
    <>
      <circle cx="6" cy="5.5" r="2.2" />
      <circle cx="6" cy="18.5" r="2.2" />
      <circle cx="18" cy="12" r="2.2" />
      <path d="M6 7.7v8.6M8 6.2l7.3 4.6M8 17.8l7.3-4.6" />
    </>
  ),
  dataModel: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" />
      <path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </>
  ),
  comment: (
    <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5Z" />
  ),
  commentAdd: (
    <>
      <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5Z" />
      <path d="M12 7.5v6M9 10.5h6" />
    </>
  ),
  annotateCursor: (
    <>
      <path d="M6 3.5 6 15.8 9.3 12.9 11.4 18 14 16.8 12 11.7 16.3 11.3Z" />
      <circle cx="18.5" cy="18.5" r="3" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21.5S19 14.8 19 9.5a7 7 0 1 0-14 0c0 5.3 7 12 7 12Z" />
      <circle cx="12" cy="9.5" r="2.6" />
    </>
  ),
  reply: <path d="M9.5 6 4 11.5 9.5 17M4 11.5h9.5a6.5 6.5 0 0 1 6.5 6.5v1" />,
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5v4h4" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 11.5a8.5 8.5 0 0 0-14.6-5" />
      <path d="M3.5 12.5a8.5 8.5 0 0 0 14.6 5" />
      <path d="M5.5 2.5v4h4M18.5 21.5v-4h-4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 5.8A8.7 8.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8" />
      <path d="M6.4 7.6A16.9 16.9 0 0 0 2.5 12S6 18.5 12 18.5a8.9 8.9 0 0 0 3.7-.8" />
      <path d="M9.9 9.9a2.8 2.8 0 0 0 3.9 3.9" />
      <path d="m4 4 16 16" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5" />
      <path d="M12 16.2v.3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16" />
      <path d="M13 9h6a1 1 0 0 1 1 1v11" />
      <path d="M3 21h18" />
      <path d="M7 8h2M7 12h2M7 16h2M16 13h1M16 17h1" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  drag: (
    <>
      <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v11.5M8 11l4 4 4-4" />
      <path d="M4.5 17v2.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V17" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V3.5M8 7.5l4-4 4 4" />
      <path d="M4.5 17v2.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V17" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
      <path d="M8.2 11h5.6M11 8.2v5.6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
      <path d="M8.2 11h5.6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.9L12 13.3 3.5 8.4Z" />
      <path d="m3.5 12.6 8.5 4.9 8.5-4.9" />
      <path d="m3.5 16.8 8.5 4.9 8.5-4.9" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
      <path d="M10 8 6 12l4 4M6 12h9.5" />
    </>
  ),
  lockOpen: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 7.6-1.8" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  list: (
    <>
      <circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9.5 6h10M9.5 12h10M9.5 18h10" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M7 17 17 7" />
      <path d="M8.5 7H17v8.5" />
    </>
  ),
  send: (
    <>
      <path d="M12 19V5" />
      <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
    </>
  ),
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none" />,
  x: <path d="M7 7l10 10M17 7 7 17" />,
  thumbsUp: (
    <>
      <path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10H7Z" />
      <path d="M7 10l4-7a2.2 2.2 0 0 1 2.6 2.6L13 9h5.3a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 16.9 20H7" />
    </>
  ),
  thumbsDown: (
    <>
      <path d="M17 14V4h2.5A1.5 1.5 0 0 1 21 5.5v7a1.5 1.5 0 0 1-1.5 1.5H17Z" />
      <path d="M17 14l-4 7a2.2 2.2 0 0 1-2.6-2.6L11 15H5.7a2 2 0 0 1-2-2.4l1.4-7A2 2 0 0 1 7.1 4H17" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1.5" />
      <path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9" />
      <path d="M10 13h4" />
    </>
  ),
  sidebar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={["wpn-icon", className].filter(Boolean).join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
