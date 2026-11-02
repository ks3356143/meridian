import styles from "./skip-link.module.css";

export const MAIN_CONTENT_ID = "main-content";

/** 键盘用户按 Tab 时的首个入口：跳过导航直达主内容。 */
export function SkipLink() {
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
      跳到主要内容
    </a>
  );
}
