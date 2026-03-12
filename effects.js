// Visual Effects System for Lucky's Market Run
// Particle effects, screen shake, animations

class EffectsSystem {
    constructor() {
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.isRunning = false;
        this.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };
    }

    init(container) {
        this.container = container;

        // Create effects canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'effects-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 50;
        `;
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas || !this.container) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.container.clientWidth * dpr;
        this.canvas.height = this.container.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
    }

    // Start animation loop
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    }

    stop() {
        this.isRunning = false;
    }

    animate() {
        if (!this.isRunning) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        this.particles = this.particles.filter(p => {
            p.update();
            if (p.life <= 0) return false;
            p.draw(this.ctx);
            return true;
        });

        // Update screen shake
        if (this.screenShake.intensity > 0.1) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
            this.screenShake.intensity *= this.screenShake.decay;

            this.container.style.transform = `translate(${this.screenShake.x}px, ${this.screenShake.y}px)`;
        } else if (this.screenShake.intensity > 0) {
            this.screenShake.intensity = 0;
            this.container.style.transform = '';
        }

        requestAnimationFrame(() => this.animate());
    }

    // Screen shake effect
    shake(intensity = 10, decay = 0.9) {
        this.screenShake.intensity = intensity;
        this.screenShake.decay = decay;
        this.start();
    }

    // Coin burst for wins
    coinBurst(x, y, count = 20) {
        this.start();
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
            const speed = 3 + Math.random() * 4;
            this.particles.push(new CoinParticle(x, y, angle, speed));
        }
    }

    // Sparkle effect
    sparkle(x, y, count = 15, color = '#ffd700') {
        this.start();
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.particles.push(new SparkleParticle(x, y, angle, speed, color));
        }
    }

    // Confetti burst
    confetti(count = 50) {
        this.start();
        const width = this.container.clientWidth;
        const colors = ['#26a69a', '#ef5350', '#2962ff', '#ffd700', '#ff6b6b', '#4ecdc4'];

        for (let i = 0; i < count; i++) {
            const x = Math.random() * width;
            const y = -20;
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new ConfettiParticle(x, y, color));
        }
    }

    // Loss effect - broken glass / red flash
    lossEffect(x, y) {
        this.start();
        this.shake(8, 0.85);

        // Red shards
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.2;
            const speed = 2 + Math.random() * 3;
            this.particles.push(new ShardParticle(x, y, angle, speed));
        }
    }

    // Pulse ring effect
    pulseRing(x, y, color = '#2962ff') {
        this.start();
        this.particles.push(new RingParticle(x, y, color));
    }

    // Number popup (for P/L display)
    numberPopup(x, y, text, color = '#26a69a', size = 24) {
        this.start();
        this.particles.push(new TextParticle(x, y, text, color, size));
    }

    // Streak fire effect
    streakFire(x, y, intensity = 1) {
        this.start();
        const count = Math.floor(5 * intensity);
        for (let i = 0; i < count; i++) {
            this.particles.push(new FireParticle(x + (Math.random() - 0.5) * 30, y));
        }
    }

    // Lucky happy animation helper
    triggerLuckyAnimation(element, animClass, duration = 500) {
        element.classList.add(animClass);
        setTimeout(() => element.classList.remove(animClass), duration);
    }

    // Flash overlay
    flash(color = 'rgba(255, 255, 255, 0.3)', duration = 150) {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${color};
            pointer-events: none;
            z-index: 100;
            animation: flashFade ${duration}ms ease-out forwards;
        `;
        this.container.appendChild(flash);
        setTimeout(() => flash.remove(), duration);
    }
}

// Particle Classes
class CoinParticle {
    constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 5;
        this.gravity = 0.3;
        this.life = 1;
        this.decay = 0.02;
        this.size = 8 + Math.random() * 4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.life;

        // Gold coin
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * Math.abs(Math.cos(this.rotation)), 0, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = '#fff8dc';
        ctx.beginPath();
        ctx.ellipse(-2, -2, this.size * 0.3, this.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class SparkleParticle {
    constructor(x, y, angle, speed, color) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1;
        this.decay = 0.03;
        this.size = 3 + Math.random() * 3;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;

        // Star shape
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 2) * i;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(
                this.x + Math.cos(angle) * this.size,
                this.y + Math.sin(angle) * this.size
            );
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

class ConfettiParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = 2 + Math.random() * 2;
        this.life = 1;
        this.decay = 0.005;
        this.width = 6 + Math.random() * 4;
        this.height = 4 + Math.random() * 3;
        this.color = color;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.wobble = Math.random() * Math.PI * 2;
        this.wobbleSpeed = 0.1 + Math.random() * 0.1;
    }

    update() {
        this.wobble += this.wobbleSpeed;
        this.x += this.vx + Math.sin(this.wobble) * 0.5;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }
}

class ShardParticle {
    constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.gravity = 0.2;
        this.life = 1;
        this.decay = 0.025;
        this.size = 5 + Math.random() * 8;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.life;

        // Red shard
        ctx.fillStyle = '#ef5350';
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.5, this.size * 0.5);
        ctx.lineTo(-this.size * 0.5, this.size * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class RingParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.maxRadius = 80;
        this.life = 1;
        this.color = color;
    }

    update() {
        this.radius += 3;
        this.life = 1 - (this.radius / this.maxRadius);
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life * 0.6;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class TextParticle {
    constructor(x, y, text, color, size) {
        this.x = x;
        this.y = y;
        this.vy = -2;
        this.life = 1;
        this.decay = 0.015;
        this.text = text;
        this.color = color;
        this.size = size;
    }

    update() {
        this.y += this.vy;
        this.vy *= 0.95;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class FireParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -3 - Math.random() * 3;
        this.life = 1;
        this.decay = 0.04;
        this.size = 6 + Math.random() * 6;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size *= 0.97;
    }

    draw(ctx) {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, `rgba(255, 200, 50, ${this.life})`);
        gradient.addColorStop(0.5, `rgba(255, 100, 50, ${this.life * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 50, 50, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Export singleton
const effects = new EffectsSystem();
export default effects;
