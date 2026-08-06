import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  className = "",
  ...props
}) {
  const buttonClass = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && "btn--full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={buttonClass}
      {...props}
    >
      {children}
    </button>
  );
}