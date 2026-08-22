import { Link } from "react-router-dom";
import styles from "./Brand.module.css";

export interface BrandProps {
  /** Suppresses the link when the brand is already on the home screen. */
  static?: boolean;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
}

export function Brand({ static: isStatic = false, size = "md", subtitle }: BrandProps) {
  const inner = (
    <>
      <span className={styles.badge}>
        <img src="/logo-mark.png" alt="" className="logo-mono" />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>
          Vote<span className={styles.accent}>Arena</span>
        </span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </>
  );

  const className = `${styles.brand} ${styles[size]}`;
  return isStatic ? (
    <span className={className}>{inner}</span>
  ) : (
    <Link to="/" className={className}>
      {inner}
    </Link>
  );
}
