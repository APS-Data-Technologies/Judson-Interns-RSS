import "./PageLayout.css";

export default function PageLayout({
  children,
  size = "default",
  className = "",
}) {
  const pageClass = [
    "rss-page-layout",
    `rss-page-layout--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <main className={pageClass}>{children}</main>;
}