const LABELS: Record<string, string> = {
  admin: "Admin",
  users: "Users & roles",
  kyc: "KYC review",
  refunds: "Refunds",
  flags: "Feature flags",
  new: "New",
};

/** Segments that only group routes and have no page of their own. */
const GROUPING_SEGMENTS = new Set(["admin"]);

export type Crumb = {
  label: string;
  /** Absent when the segment has no page to link to. */
  href?: string;
  current: boolean;
};

export function breadcrumbTrail(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const trail: Crumb[] = [
    {
      label: "Console",
      href: segments.length === 0 ? undefined : "/",
      current: segments.length === 0,
    },
  ];

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    const linkable = !isLast && !GROUPING_SEGMENTS.has(segment);
    trail.push({
      label: LABELS[segment] ?? segment.replace(/-/g, " "),
      href: linkable ? `/${segments.slice(0, index + 1).join("/")}` : undefined,
      current: isLast,
    });
  });

  return trail;
}
