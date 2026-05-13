/**
 * Kairon Daily Planner — Morning planning ritual
 */

export class DailyPlanner {
  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return "🌙 Night owl mode";
    if (hour < 12) return "☀️ Good morning";
    if (hour < 17) return "🌤️ Good afternoon";
    if (hour < 21) return "🌅 Good evening";
    return "🌙 Winding down";
  }

  getYesterdayWins(tasks) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    return tasks.filter(t => t.status === "completed" && t.completedAt?.startsWith(yesterday));
  }

  getTodayTasks(tasks) {
    const today = new Date().toISOString().split("T")[0];
    return tasks.filter(t => t.status !== "completed" && t.dueDateTime?.startsWith(today));
  }

  getOverdue(tasks) {
    const now = new Date().toISOString();
    return tasks.filter(t => t.status !== "completed" && t.dueDateTime && t.dueDateTime < now);
  }

  renderPlannerHTML(tasks, streak) {
    const greeting = this.getGreeting();
    const todayTasks = this.getTodayTasks(tasks);
    const overdue = this.getOverdue(tasks);
    const wins = this.getYesterdayWins(tasks);
    
    return `
      <div class="planner-ritual card p-6 mb-6 border-l-4 border-purple-500">
        <h2 class="text-lg font-bold mb-1">${greeting}</h2>
        <p class="text-sm text-gray-500 mb-4">Let's plan your day</p>
        
        ${wins.length > 0 ? `
          <div class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p class="text-xs font-bold text-green-600 mb-1">Yesterday's wins (${wins.length})</p>
            <p class="text-xs text-green-700">${wins.slice(0, 3).map(t => `✓ ${t.title}`).join(" · ")}${wins.length > 3 ? ` +${wins.length - 3} more` : ""}</p>
          </div>
        ` : ""}
        
        ${overdue.length > 0 ? `
          <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p class="text-xs font-bold text-red-600">${overdue.length} overdue task${overdue.length > 1 ? "s" : ""} need attention</p>
          </div>
        ` : ""}
        
        <div class="mb-4">
          <p class="text-xs font-bold text-gray-500 mb-2">Today's focus (${todayTasks.length} tasks)</p>
          ${todayTasks.length > 0 ? todayTasks.slice(0, 5).map(t => `
            <div class="flex items-center gap-2 py-1">
              <span class="w-2 h-2 rounded-full ${t.priority === "high" ? "bg-red-500" : t.priority === "medium" ? "bg-yellow-500" : "bg-green-500"}"></span>
              <span class="text-sm">${t.title}</span>
            </div>
          `).join("") : '<p class="text-sm text-gray-400">No tasks due today — nice!</p>'}
        </div>

        <div class="flex items-center justify-between pt-3 border-t">
          <div class="flex items-center gap-2">
            <span class="text-lg">${streak.current >= 7 ? "🔥" : streak.current >= 1 ? "⚡" : "💤"}</span>
            <span class="text-sm font-bold">${streak.current} day streak</span>
          </div>
          <button onclick="closePlanner()" class="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700">
            Let's go →
          </button>
        </div>
      </div>
    `;
  }
}
