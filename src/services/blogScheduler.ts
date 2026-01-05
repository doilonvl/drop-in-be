import { blogRepo } from "../repositories/blog.repo";

const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;

export const startBlogScheduler = () => {
  const intervalMs = Math.max(
    Number(process.env.BLOG_PUBLISH_INTERVAL_MS) || DEFAULT_INTERVAL_MS,
    30 * 1000
  );

  const runOnce = async () => {
    try {
      await blogRepo.publishScheduled();
    } catch (err) {
      console.error("[BLOG SCHEDULER]", err);
    }
  };

  void runOnce();

  const timer = setInterval(runOnce, intervalMs);

  timer.unref?.();
  return timer;
};
