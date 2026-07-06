import "./Card.css";

export default function Card({
  children,
  variant = "default",
  padding = "md",
  shadow = "sm",
  className = "",
  ...props
}) {
  const cardClass = [
    "rss-card",
    `rss-card--${variant}`,
    `rss-card--padding-${padding}`,
    `rss-card--shadow-${shadow}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} {...props}>
      {children}
    </div>
  );
}