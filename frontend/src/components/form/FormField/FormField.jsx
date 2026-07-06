import "./FormField.css";

export default function FormField({
  label,
  required = false,
  helperText,
  error,
  children,
  className = "",
}) {
  const fieldClass = [
    "rss-form-field",
    error && "rss-form-field--error",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={fieldClass}>
      {label && (
        <label className="rss-form-field__label">
          {label}
          {required && <span className="rss-form-field__required">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p className="rss-form-field__error">{error}</p>
      ) : (
        helperText && <p className="rss-form-field__helper">{helperText}</p>
      )}
    </div>
  );
}