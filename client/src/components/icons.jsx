import React from "react";

/* A small, consistent line-icon set (1.6 stroke, 24 grid). */
const S = ({ children, size = 20, ...p }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...p}
  >
    {children}
  </svg>
);

export const PhoneCall = (p) => (
  <S {...p}>
    <path d="M14.5 3.5a5 5 0 0 1 5 5M14.5 7a1.5 1.5 0 0 1 1.5 1.5" />
    <path d="M5 4h3l1.5 4-2 1.2a11 11 0 0 0 5.3 5.3L14 12.5 18 14v3a2 2 0 0 1-2.2 2A15 15 0 0 1 3 6.2 2 2 0 0 1 5 4Z" />
  </S>
);

export const History = (p) => (
  <S {...p}>
    <path d="M3 5.5A8.5 8.5 0 1 1 4 13" />
    <path d="M3 5.5V9h3.5" />
    <path d="M12 8v4.2l2.8 1.7" />
  </S>
);

export const Layers = (p) => (
  <S {...p}>
    <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
    <path d="m3 12 9 4.5L21 12" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </S>
);

export const Gauge = (p) => (
  <S {...p}>
    <path d="M12 14a8 8 0 1 1 8-8" opacity="0" />
    <path d="M4 14a8 8 0 1 1 16 0" />
    <path d="m12 14 4-4" />
    <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
  </S>
);

export const Settings = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" />
  </S>
);

export const Mic = (p) => (
  <S {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
    <path d="M12 18v3M9 21h6" />
  </S>
);

export const Sparkle = (p) => (
  <S {...p}>
    <path d="M12 3.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5Z" />
    <path d="M18.5 14c.3 1.6.8 2.1 2.5 2.5-1.7.4-2.2.9-2.5 2.5-.3-1.6-.8-2.1-2.5-2.5 1.7-.4 2.2-.9 2.5-2.5Z" />
  </S>
);

export const Clock = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </S>
);

export const ArrowRight = (p) => (
  <S {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </S>
);

export const Plus = (p) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);

export const X = (p) => (
  <S {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </S>
);

export const Check = (p) => (
  <S {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </S>
);

export const ChevronDown = (p) => (
  <S {...p}>
    <path d="m6 9 6 6 6-6" />
  </S>
);

export const Activity = (p) => (
  <S {...p}>
    <path d="M3 12h3l2.5-7 5 16 2.5-9H21" />
  </S>
);

export const Shield = (p) => (
  <S {...p}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.2 7 9 4.1-1.8 7-4.8 7-9V6l-7-3Z" />
    <path d="m9.5 12 1.8 1.8L15 10" />
  </S>
);

export const User = (p) => (
  <S {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </S>
);

export const Users = (p) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17 13.4a5.5 5.5 0 0 1 3.5 5.1" />
  </S>
);

export const Building = (p) => (
  <S {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    <path d="M10 21v-3h4v3" />
  </S>
);

export const Globe = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </S>
);

export const ArrowLeft = (p) => (
  <S {...p}>
    <path d="M19 12H5M11 6 5 12l6 6" />
  </S>
);

export const Languages = (p) => (
  <S {...p}>
    <path d="M4 5h7M7.5 5v0c0 4-2 7-4 8.5M5 9c0 2 2 3.5 5 4.5" />
    <path d="M13 20l3.5-9 3.5 9M14.3 17h4.4" />
  </S>
);

export const Target = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </S>
);

export const FileText = (p) => (
  <S {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5M8.5 13h7M8.5 16.5h7" />
  </S>
);

export const Send = (p) => (
  <S {...p}>
    <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4Z" />
  </S>
);

export const Lock = (p) => (
  <S {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </S>
);
