export { AnimatePresence, MotionConfig, animate, motion } from "motion/react";

/**
 * 系统是否开启「减少动态效果」。
 * 只用于入场类动画（页面/列表/充能）降级；交互与状态反馈按项目规范保持全量播放。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
