/**
 * Kairon Streaks — Momentum tracking system
 * Tracks daily completion streaks, best streaks, and freeze tokens.
 */

export class StreakManager {
  constructor(db) {
    this.db = db; // Dexie instance
  }

  async getStreak(userId) {
    const stored = await this.db.settings.get(`${userId}_streak`);
    return stored?.value || { current: 0, best: 0, lastCompletedDate: null, freezesAvailable: 0, freezeUsedThisWeek: false };
  }

  async updateStreak(userId, tasks) {
    const streak = await this.getStreak(userId);
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Check if user completed at least 1 task today
    const completedToday = tasks.some(t => 
      t.status === "completed" && t.completedAt?.startsWith(today)
    );

    if (!completedToday) return streak;

    if (streak.lastCompletedDate === today) {
      return streak; // Already counted today
    }

    if (streak.lastCompletedDate === yesterday) {
      // Continue streak
      streak.current += 1;
    } else if (streak.lastCompletedDate && streak.lastCompletedDate < yesterday) {
      // Streak broken — check for freeze
      if (streak.freezesAvailable > 0 && !streak.freezeUsedThisWeek) {
        streak.freezesAvailable -= 1;
        streak.freezeUsedThisWeek = true;
        streak.current += 1; // Freeze saves the streak
      } else {
        streak.current = 1; // Reset
        streak.freezeUsedThisWeek = false;
      }
    } else {
      streak.current = 1; // First day
    }

    streak.lastCompletedDate = today;
    streak.best = Math.max(streak.best, streak.current);

    // Earn freeze every 7 days
    if (streak.current > 0 && streak.current % 7 === 0) {
      streak.freezesAvailable = Math.min(streak.freezesAvailable + 1, 3);
    }

    // Reset weekly freeze flag on Monday
    if (new Date().getDay() === 1) {
      streak.freezeUsedThisWeek = false;
    }

    await this.db.settings.put({ key: `${userId}_streak`, value: streak });
    return streak;
  }

  getStreakEmoji(current) {
    if (current >= 30) return "🏆";
    if (current >= 14) return "💎";
    if (current >= 7) return "🔥";
    if (current >= 3) return "⚡";
    if (current >= 1) return "✨";
    return "💤";
  }

  getMotivation(current) {
    if (current === 0) return "Start your streak today!";
    if (current === 1) return "Day 1 — the hardest part is starting!";
    if (current < 7) return `${current} days! Keep pushing to 7!`;
    if (current === 7) return "🎉 One full week! You earned a streak freeze!";
    if (current < 14) return `${current} days strong! Two weeks is next!`;
    if (current === 14) return "💎 Two weeks! You're building a real habit!";
    if (current < 30) return `${current} days! Almost a full month!`;
    if (current >= 30) return `🏆 ${current} days! You're unstoppable!`;
    return `${current} day streak!`;
  }
}
