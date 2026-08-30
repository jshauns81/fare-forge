// Stroke-based inline SVG icon set (matches the design canvas glyphs).

function Svg({ size = 16, stroke = 'currentColor', strokeWidth = 2, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Flame = (p) => (
  <Svg {...p}><path d="M12 3c1 3-3 4.5-3 8a5 5 0 0 0 10 0c0-2-1-3.5-2-4.5 0 1.5-.7 2.5-2 3 .5-2.5-1-5-3-6.5z" /></Svg>
);
export const FlameBase = (p) => (
  <Svg {...p}><path d="M12 3c1 3-3 4.5-3 8a5 5 0 0 0 10 0c0-2-1-3.5-2-4.5 0 1.5-.7 2.5-2 3 .5-2.5-1-5-3-6.5z" /><path d="M5 21h14" /></Svg>
);
export const Board = (p) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18" /><path d="M8 4V2M16 4V2" /></Svg>
);
export const Box = (p) => (
  <Svg {...p}><path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v10" /></Svg>
);
export const Cart = (p) => (
  <Svg {...p}><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6L5 3H2" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></Svg>
);
export const LinkIcon = (p) => (
  <Svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>
);
export const Plus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const Minus = (p) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const Check = (p) => <Svg strokeWidth={2.5} {...p}><path d="M4 12l5 5L20 6" /></Svg>;
export const X = (p) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const ChevronLeft = (p) => <Svg strokeWidth={2.5} {...p}><path d="M15 6l-6 6 6 6" /></Svg>;
export const ChevronRight = (p) => <Svg strokeWidth={2.5} {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const ArrowRight = (p) => <Svg strokeWidth={2.5} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const External = (p) => <Svg {...p}><path d="M7 17L17 7M9 7h8v8" /></Svg>;
export const Printer = (p) => (
  <Svg {...p}><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="1.5" /><path d="M7 17h10v4H7z" /></Svg>
);
export const CopyIcon = (p) => (
  <Svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>
);
export const Redo = (p) => <Svg {...p}><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 5v7h7" /></Svg>;
export const Trash = (p) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 14h10l1-14" /></Svg>
);
export const Scissors = (p) => (
  <Svg {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8 7.5L20 19M8 16.5L20 5" /></Svg>
);
export const Spinner = (p) => (
  <Svg className="spin" strokeWidth={2.5} {...p}><circle cx="12" cy="12" r="9" strokeDasharray="42 14" /></Svg>
);
export const Wave = (p) => <Svg {...p}><path d="M3 12h4l2-7 4 14 2-7h6" /></Svg>;
