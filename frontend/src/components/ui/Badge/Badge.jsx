import "./Badge.css";

export default function Badge({
  children,
  tone = "default",
  size = "md",
  className = "",
  ...props
}) {
  const badgeClass = [
    "rss-badge",
    `rss-badge--${tone}`,
    `rss-badge--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={badgeClass} {...props}>
      {children}
    </span>
  );
}