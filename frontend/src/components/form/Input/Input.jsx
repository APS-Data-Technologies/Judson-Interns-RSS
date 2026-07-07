import FormField from "../FormField";
import "./Input.css";

export default function Input({
  label,
  required = false,
  helperText,
  error,
  fullWidth = true,
  leftIcon,
  rightElement,
  className = "",
  ...props
}) {
  const inputClass = [
    "rss-input",
    leftIcon && "rss-input--has-left-icon",
    rightElement && "rss-input--has-right-element",
    error && "rss-input--error",
    fullWidth && "rss-input--full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <FormField
      label={label}
      required={required}
      helperText={helperText}
      error={error}
    >
      <div className="rss-input-wrapper">
        {leftIcon && <span className="rss-input-icon">{leftIcon}</span>}
        <input className={inputClass} {...props} />
        {rightElement && (
          <span className="rss-input-right">{rightElement}</span>
        )}
      </div>
    </FormField>
  );
}