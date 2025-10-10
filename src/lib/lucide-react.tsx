import * as React from "react";

type IconProps = React.SVGAttributes<SVGElement> & { size?: number | string };

function createIcon(path: React.ReactNode, displayName: string) {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(
    ({ size = 24, strokeWidth = 2, className, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth as number}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {path}
      </svg>
    )
  );
  Icon.displayName = displayName;
  return Icon;
}

export const Menu = createIcon(
  <>
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </>,
  "Menu"
);

export const LayoutDashboard = createIcon(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="15" width="7" height="6" rx="1" />
  </>,
  "LayoutDashboard"
);

export const Boxes = createIcon(
  <>
    <path d="M4 7.5V17a1 1 0 0 0 .553.894l6 3a1 1 0 0 0 .894 0l6-3A1 1 0 0 0 18 17V7.5" />
    <path d="m4.553 7.894 6 3a1 1 0 0 0 .894 0l6-3" />
    <path d="m12 3 6 3-6 3-6-3Z" />
  </>,
  "Boxes"
);

export const PanelLeftClose = createIcon(
  <>
    <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="m12 8-3 4 3 4" />
  </>,
  "PanelLeftClose"
);

export const Wrench = createIcon(
  <>
    <path d="M14.7 6.3a1 1 0 0 1 .3.71V9a1 1 0 0 0 1 1h2a1 1 0 0 1 .71.3l1.52 1.52a5.001 5.001 0 0 1-7.07 7.07L11.3 17.7a1 1 0 0 1-.3-.71V15a1 1 0 0 0-1-1H8a1 1 0 0 1-.71-.3L5.77 12.7a5.001 5.001 0 0 1 7.07-7.07Z" />
  </>,
  "Wrench"
);

export const Sun = createIcon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>,
  "Sun"
);

export const Moon = createIcon(
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />, "Moon"
);

export const Bell = createIcon(
  <>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>,
  "Bell"
);

export const UserRound = createIcon(
  <>
    <path d="M18 20a6 6 0 1 0-12 0" />
    <circle cx="12" cy="10" r="4" />
  </>,
  "UserRound"
);

export const Search = createIcon(
  <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
  </>,
  "Search"
);

export const X = createIcon(
  <>
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </>,
  "X"
);
