/**
 * Kairon Celebrations — Dopamine hits on task completion
 */

export class Celebrations {
  constructor() {
    this._confettiColors = ["#667eea", "#764ba2", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];
  }

  // Confetti explosion
  confetti(intensity = "normal") {
    const count = intensity === "big" ? 150 : intensity === "small" ? 30 : 80;
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      const color = this._confettiColors[Math.floor(Math.random() * this._confettiColors.length)];
      const size = Math.random() * 8 + 4;
      const x = Math.random() * 100;
      const rotation = Math.random() * 360;
      const duration = Math.random() * 2 + 1.5;
      const delay = Math.random() * 0.5;
      
      piece.style.cssText = `
        position:absolute; top:-10px; left:${x}%;
        width:${size}px; height:${size * 0.6}px;
        background:${color}; border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
        transform:rotate(${rotation}deg);
        animation: confetti-fall ${duration}s ease-in ${delay}s forwards;
      `;
      container.appendChild(piece);
    }

    // Add keyframes if not present
    if (!document.getElementById("confetti-style")) {
      const style = document.createElement("style");
      style.id = "confetti-style";
      style.textContent = `
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => container.remove(), 4000);
  }

  // Completion sound (subtle click/ding)
  playSound(type = "complete") {
    const sounds = {
      complete: [523.25, 659.25, 783.99], // C-E-G chord
      streak: [523.25, 659.25, 783.99, 1046.50], // C-E-G-C octave
      allDone: [523.25, 587.33, 659.25, 783.99, 1046.50], // Full scale
    };
    
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = sounds[type] || sounds.complete;
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.1;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5 + i * 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + 0.5 + i * 0.1);
    });
  }

  // Task completed — small celebration
  onTaskComplete(remainingToday) {
    this.playSound("complete");
    this.confetti("small");
    
    if (remainingToday === 0) {
      // All tasks done for today!
      setTimeout(() => {
        this.playSound("allDone");
        this.confetti("big");
      }, 500);
    }
  }

  // Streak milestone
  onStreakMilestone(days) {
    this.playSound("streak");
    this.confetti("big");
  }
}
