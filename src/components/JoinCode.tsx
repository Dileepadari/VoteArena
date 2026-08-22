import styles from "./JoinCode.module.css";

export interface JoinCodeProps {
  code: string;
  size?: "sm" | "md" | "lg" | "wall";
  onCopy?: () => void;
}

/** The join code as individual tiles, which is far easier to read aloud and copy off a screen. */
export function JoinCode({ code, size = "md", onCopy }: JoinCodeProps) {
  const content = (
    <span className={`${styles.code} ${styles[size]}`} aria-label={`Join code ${code.split("").join(" ")}`}>
      {code.split("").map((char, index) => (
        <span key={`${char}-${index}`} className={styles.char} aria-hidden>
          {char}
        </span>
      ))}
    </span>
  );

  if (!onCopy) return content;

  return (
    <button type="button" className={styles.button} onClick={onCopy} title="Copy join code">
      {content}
    </button>
  );
}
