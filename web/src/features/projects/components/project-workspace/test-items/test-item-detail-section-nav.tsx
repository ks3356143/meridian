import { Check, CheckCircle2, CloudUpload, Loader2 } from "lucide-react";
import styles from "./test-item-detail.module.css";

export type TestItemSaveState = "saved" | "editing" | "saving" | "error";
type TestItemSectionStep = {
  id: string;
  label: string;
  step: number;
  count: number | null;
  done: boolean;
  unit: string;
};

export function TestItemSectionNav({
  saveChipKey,
  saveState,
  activeSection,
  sectionSteps,
  onJump,
}: {
  saveChipKey: number;
  saveState: TestItemSaveState;
  activeSection: string;
  sectionSteps: TestItemSectionStep[];
  onJump: (id: string) => void;
}) {
  return (
    <nav className={styles.sectionNav} aria-label="测试项分区导航" data-section-nav>
      <span
        key={saveChipKey}
        className={styles.statusChip}
        data-save-state={saveState}
        aria-live="polite"
      >
        {saveState === "saving" ? (
          <>
            <Loader2 aria-hidden />
            保存中
          </>
        ) : saveState === "error" ? (
          "保存失败"
        ) : saveState === "editing" ? (
          <>
            <CloudUpload aria-hidden />
            待自动保存
          </>
        ) : (
          <>
            <CheckCircle2 aria-hidden />
            已自动保存
          </>
        )}
      </span>
      {sectionSteps.map((section) => (
        <button
          key={section.id}
          type="button"
          className={styles.sectionLink}
          data-active={activeSection === section.id ? "true" : undefined}
          data-state={activeSection === section.id ? "active" : section.done ? "done" : "pending"}
          aria-current={activeSection === section.id ? "location" : undefined}
          aria-label={`第 ${section.step} 步 ${section.label}，${section.done ? "已完成" : "未完成"}${section.count !== null && section.count > 0 ? `，${section.count} ${section.unit}` : ""}`}
          onClick={() => onJump(section.id)}
        >
          <span
            className={styles.sectionStep}
            data-done={section.done ? "true" : undefined}
            aria-hidden
          >
            {section.done ? <Check aria-hidden /> : section.step}
          </span>
          {section.label}
          {section.count !== null && section.count > 0 ? (
            <span
              className={styles.sectionCount}
              title={`${section.count} ${section.unit}`}
              aria-hidden
            >
              {section.count}
              <span className={styles.sectionCountUnit}>{section.unit}</span>
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
