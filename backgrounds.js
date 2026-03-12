// Background Scenes for Lucky's Market Run
// Semi-transparent pixel art style backgrounds that change each level

const isMobileBackground = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

class BackgroundSystem {
    constructor() {
        this.currentScene = 0;
        this.time = 0;
        this.stars = [];
        this.width = 1920;
        this.height = 1080;
        this.isMobile = isMobileBackground;
    }

    init(container) {
        this.container = container;
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        // Generate stars for space scenes
        this.generateStars();

        window.addEventListener('resize', () => {
            this.width = this.container.clientWidth;
            this.height = this.container.clientHeight;
            this.generateStars();
            this.isMobile = window.innerWidth <= 768;
        });

        console.log('Background system initialized', this.width, this.height);
    }

    generateStars() {
        this.stars = [];
        const w = this.width || 1920;
        const h = this.height || 1080;
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 2 + 0.5,
                twinkle: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.02 + 0.01
            });
        }
    }

    setLevel(level) {
        // Cycle through scenes based on level
        const scenes = [
            'synthwaveGrid',
            'synthwaveSun',
            'planet',
            'synthwaveMountains',
            'solarSystem',
            'synthwaveCity',
            'cityscape',
            'synthwavePalms',
            'forest',
            'freeway',
            'synthwaveWave',
            'sunset',
            'mountains',
            'synthwaveCar',
            'ocean',
            'aurora',
            'nebula',
            'desert',
            'tokyo'
        ];
        this.currentScene = (level - 1) % scenes.length;
        this.particles = [];
    }

    getSceneName(level) {
        const scenes = [
            'Synthwave Grid',
            'Retrowave Sunset',
            'Distant Planet',
            'Neon Mountains',
            'Solar System',
            'Cyber City',
            'City Skyline',
            'Palm Drive',
            'Enchanted Forest',
            'Night Highway',
            'Digital Ocean',
            'Golden Sunset',
            'Mountain Range',
            'Outrun',
            'Deep Ocean',
            'Northern Lights',
            'Cosmic Nebula',
            'Desert Dunes',
            'Neon Tokyo'
        ];
        return scenes[(level - 1) % scenes.length];
    }

    // Draw to an external context (for rendering to main chart canvas)
    drawToContext(ctx, w, h) {
        this.time += 0.008; // Increment time for animations (smoother)

        // Generate stars if dimensions changed
        if (this.width !== w || this.height !== h) {
            this.width = w;
            this.height = h;
            this.generateStars();
        }

        switch (this.currentScene) {
            case 0: this.drawSynthwaveGrid(ctx, w, h); break;
            case 1: this.drawSynthwaveSun(ctx, w, h); break;
            case 2: this.drawPlanet(ctx, w, h); break;
            case 3: this.drawSynthwaveMountains(ctx, w, h); break;
            case 4: this.drawSolarSystem(ctx, w, h); break;
            case 5: this.drawSynthwaveCity(ctx, w, h); break;
            case 6: this.drawCityscape(ctx, w, h); break;
            case 7: this.drawSynthwavePalms(ctx, w, h); break;
            case 8: this.drawForest(ctx, w, h); break;
            case 9: this.drawFreeway(ctx, w, h); break;
            case 10: this.drawSynthwaveWave(ctx, w, h); break;
            case 11: this.drawSunset(ctx, w, h); break;
            case 12: this.drawMountains(ctx, w, h); break;
            case 13: this.drawSynthwaveCar(ctx, w, h); break;
            case 14: this.drawOcean(ctx, w, h); break;
            case 15: this.drawAurora(ctx, w, h); break;
            case 16: this.drawNebula(ctx, w, h); break;
            case 17: this.drawDesert(ctx, w, h); break;
            case 18: this.drawTokyo(ctx, w, h); break;
        }
    }

    // Helper: Draw twinkling stars
    drawStars(ctx, w, h, color = '#ffffff') {
        this.stars.forEach(star => {
            star.twinkle += star.speed;
            const alpha = 0.3 + Math.sin(star.twinkle) * 0.3;
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // ==================== SYNTHWAVE SCENES ====================

    // Synthwave Grid - Classic 80s perspective grid with horizon
    drawSynthwaveGrid(ctx, w, h) {
        const horizon = h * 0.45;

        // Sky gradient - purple to pink
        const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGradient.addColorStop(0, '#0d0221');
        skyGradient.addColorStop(0.5, '#2a1040');
        skyGradient.addColorStop(1, '#ff0080');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, horizon);

        this.drawStars(ctx, w, horizon * 0.8, '#ff66ff');

        // Ground gradient
        const groundGradient = ctx.createLinearGradient(0, horizon, 0, h);
        groundGradient.addColorStop(0, '#ff0080');
        groundGradient.addColorStop(0.1, '#2a0040');
        groundGradient.addColorStop(1, '#0d0015');
        ctx.fillStyle = groundGradient;
        ctx.fillRect(0, horizon, w, h - horizon);

        // Perspective grid lines - horizontal (more subtle on mobile)
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1;
        const gridAlphaMultiplier = this.isMobile ? 0.3 : 1;
        for (let i = 0; i < 20; i++) {
            const y = horizon + Math.pow(i / 20, 2) * (h - horizon);
            ctx.globalAlpha = (0.3 + (i / 20) * 0.4) * gridAlphaMultiplier;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Perspective grid lines - vertical (converging to horizon center)
        const vanishX = w / 2;
        ctx.globalAlpha = this.isMobile ? 0.15 : 0.5;
        for (let i = -15; i <= 15; i++) {
            const bottomX = vanishX + i * (w / 10);
            ctx.beginPath();
            ctx.moveTo(vanishX, horizon);
            ctx.lineTo(bottomX, h);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Animated scan line (hidden on mobile)
        if (!this.isMobile) {
            const scanY = horizon + ((this.time * 100) % (h - horizon));
            ctx.strokeStyle = '#00ffff';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, scanY);
            ctx.lineTo(w, scanY);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    // Synthwave Sun - Big gradient sun on horizon
    drawSynthwaveSun(ctx, w, h) {
        const horizon = h * 0.55;

        // Dark sky
        const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGradient.addColorStop(0, '#0a0015');
        skyGradient.addColorStop(0.6, '#1a0030');
        skyGradient.addColorStop(1, '#400060');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, horizon);

        this.drawStars(ctx, w, h * 0.4);

        // Big synthwave sun
        const sunX = w / 2;
        const sunY = horizon;
        const sunR = Math.min(w, h) * 0.25;

        // Sun glow
        const glowGradient = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 1.5);
        glowGradient.addColorStop(0, 'rgba(255, 100, 200, 0.3)');
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Sun body with horizontal lines
        const sunGradient = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
        sunGradient.addColorStop(0, '#ffff00');
        sunGradient.addColorStop(0.3, '#ff8800');
        sunGradient.addColorStop(0.6, '#ff0066');
        sunGradient.addColorStop(1, '#aa0044');
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR, Math.PI, 0);
        ctx.fill();

        // Sun horizontal stripe lines
        ctx.fillStyle = '#0a0015';
        for (let i = 1; i < 8; i++) {
            const stripeY = sunY - sunR + (i * sunR * 2 / 8);
            if (stripeY > sunY) continue;
            const stripeH = 3 + i * 1.5;
            const stripeW = Math.sqrt(sunR * sunR - Math.pow(stripeY - sunY, 2)) * 2;
            ctx.fillRect(sunX - stripeW / 2, stripeY, stripeW, stripeH);
        }

        // Water/ground
        ctx.fillStyle = '#0a000f';
        ctx.fillRect(0, horizon, w, h - horizon);

        // Sun reflection
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.moveTo(sunX - sunR * 0.8, horizon);
        ctx.lineTo(sunX + sunR * 0.8, horizon);
        ctx.lineTo(sunX + sunR * 0.3, h);
        ctx.lineTo(sunX - sunR * 0.3, h);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Synthwave Mountains - Wireframe mountains with grid
    drawSynthwaveMountains(ctx, w, h) {
        const horizon = h * 0.4;

        // Sky
        const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGradient.addColorStop(0, '#000020');
        skyGradient.addColorStop(1, '#200040');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, horizon);

        this.drawStars(ctx, w, horizon);

        // Ground
        ctx.fillStyle = '#0a0010';
        ctx.fillRect(0, horizon, w, h - horizon);

        // Wireframe mountains
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;

        // Mountain 1
        ctx.beginPath();
        ctx.moveTo(0, horizon + 100);
        ctx.lineTo(w * 0.25, horizon - 50);
        ctx.lineTo(w * 0.4, horizon + 50);
        ctx.stroke();

        // Mountain 2
        ctx.strokeStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(w * 0.2, horizon + 80);
        ctx.lineTo(w * 0.5, horizon - 100);
        ctx.lineTo(w * 0.75, horizon + 60);
        ctx.stroke();

        // Mountain 3
        ctx.strokeStyle = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(w * 0.6, horizon + 70);
        ctx.lineTo(w * 0.85, horizon - 30);
        ctx.lineTo(w, horizon + 90);
        ctx.stroke();

        ctx.globalAlpha = 1;

        // Grid on ground
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        const vanishX = w / 2;
        for (let i = -10; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(vanishX, horizon);
            ctx.lineTo(vanishX + i * (w / 8), h);
            ctx.stroke();
        }
        for (let i = 0; i < 10; i++) {
            const y = horizon + Math.pow(i / 10, 1.5) * (h - horizon);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Synthwave City - Neon cityscape silhouette
    drawSynthwaveCity(ctx, w, h) {
        const horizon = h * 0.5;

        // Sky gradient
        const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGradient.addColorStop(0, '#0a0020');
        skyGradient.addColorStop(0.7, '#2a0050');
        skyGradient.addColorStop(1, '#ff0080');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, horizon);

        this.drawStars(ctx, w, h * 0.3);

        // Ground
        ctx.fillStyle = '#0a0010';
        ctx.fillRect(0, horizon, w, h - horizon);

        // City silhouette
        ctx.fillStyle = '#0a0015';
        const buildings = [];
        for (let i = 0; i < 25; i++) {
            buildings.push({
                x: i * (w / 20) - 20,
                w: 30 + Math.random() * 50,
                h: 80 + Math.random() * 200
            });
        }

        buildings.forEach(b => {
            ctx.fillRect(b.x, horizon - b.h, b.w, b.h + 50);
        });

        // Neon outlines on buildings
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        buildings.forEach((b, i) => {
            if (i % 3 === 0) {
                ctx.strokeStyle = '#ff00ff';
            } else {
                ctx.strokeStyle = '#00ffff';
            }
            ctx.strokeRect(b.x, horizon - b.h, b.w, b.h);
        });

        // Neon signs
        ctx.globalAlpha = 0.8;
        buildings.forEach((b, i) => {
            if (i % 4 === 0) {
                const signY = horizon - b.h + 30;
                ctx.fillStyle = i % 2 === 0 ? '#ff0080' : '#00ffff';
                ctx.fillRect(b.x + 5, signY, b.w - 10, 8);
            }
        });
        ctx.globalAlpha = 1;

        // Reflection
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.scale(1, -1);
        ctx.translate(0, -horizon * 2);
        buildings.forEach(b => {
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(b.x, horizon - b.h, b.w, b.h);
        });
        ctx.restore();
    }

    // Synthwave Palms - Palm trees silhouette with sunset
    drawSynthwavePalms(ctx, w, h) {
        const horizon = h * 0.6;

        // Sky gradient - warm sunset
        const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGradient.addColorStop(0, '#1a0030');
        skyGradient.addColorStop(0.4, '#4a0060');
        skyGradient.addColorStop(0.7, '#ff4080');
        skyGradient.addColorStop(1, '#ffaa00');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, horizon);

        // Sun
        const sunGradient = ctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, 80);
        sunGradient.addColorStop(0, '#ffff66');
        sunGradient.addColorStop(0.5, '#ff6600');
        sunGradient.addColorStop(1, '#ff0066');
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(w * 0.5, horizon, 70, Math.PI, 0);
        ctx.fill();

        // Ground
        ctx.fillStyle = '#0a0008';
        ctx.fillRect(0, horizon, w, h - horizon);

        // Palm trees
        const palms = [
            { x: w * 0.1, scale: 1.2 },
            { x: w * 0.25, scale: 0.8 },
            { x: w * 0.7, scale: 1 },
            { x: w * 0.85, scale: 1.1 },
            { x: w * 0.95, scale: 0.7 }
        ];

        ctx.fillStyle = '#050005';
        palms.forEach(palm => {
            this.drawPalmTree(ctx, palm.x, horizon, palm.scale);
        });
    }

    drawPalmTree(ctx, x, baseY, scale) {
        const trunkH = 120 * scale;
        const trunkW = 8 * scale;

        // Curved trunk
        ctx.beginPath();
        ctx.moveTo(x - trunkW / 2, baseY);
        ctx.quadraticCurveTo(x + 15 * scale, baseY - trunkH * 0.5, x + 5 * scale, baseY - trunkH);
        ctx.lineTo(x + 5 * scale + trunkW, baseY - trunkH);
        ctx.quadraticCurveTo(x + 15 * scale + trunkW, baseY - trunkH * 0.5, x + trunkW / 2, baseY);
        ctx.fill();

        // Palm fronds
        const frondX = x + 5 * scale;
        const frondY = baseY - trunkH;
        for (let i = 0; i < 7; i++) {
            const angle = -Math.PI / 2 + (i - 3) * 0.4;
            const len = 50 * scale + Math.abs(i - 3) * 10 * scale;
            ctx.beginPath();
            ctx.moveTo(frondX, frondY);
            ctx.quadraticCurveTo(
                frondX + Math.cos(angle) * len * 0.5,
                frondY + Math.sin(angle) * len * 0.5 - 20 * scale,
                frondX + Math.cos(angle) * len,
                frondY + Math.sin(angle) * len + 10 * scale
            );
            ctx.lineTo(frondX + Math.cos(angle) * len - 5, frondY + Math.sin(angle) * len + 15 * scale);
            ctx.quadraticCurveTo(
                frondX + Math.cos(angle) * len * 0.5 - 3,
                frondY + Math.sin(angle) * len * 0.5,
                frondX, frondY
            );
            ctx.fill();
        }
    }

    // Synthwave Wave - Digital wave pattern
    drawSynthwaveWave(ctx, w, h) {
        // Dark background
        ctx.fillStyle = '#0a0015';
        ctx.fillRect(0, 0, w, h);

        this.drawStars(ctx, w, h * 0.4, '#ff66ff');

        // Multiple animated waves
        const waveColors = ['#ff00ff', '#00ffff', '#ff0080', '#8000ff'];
        waveColors.forEach((color, index) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6 - index * 0.1;

            ctx.beginPath();
            for (let x = 0; x <= w; x += 5) {
                const y = h * (0.4 + index * 0.12) +
                    Math.sin(x * 0.02 + this.time * 2 + index) * 30 +
                    Math.sin(x * 0.01 + this.time + index * 0.5) * 20;
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        // Grid floor
        const floorY = h * 0.75;
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;

        const vanishX = w / 2;
        for (let i = -12; i <= 12; i++) {
            ctx.beginPath();
            ctx.moveTo(vanishX, floorY);
            ctx.lineTo(vanishX + i * (w / 10), h);
            ctx.stroke();
        }
        for (let i = 0; i < 8; i++) {
            const y = floorY + Math.pow(i / 8, 1.5) * (h - floorY);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Synthwave Car - Outrun style with car on road
    drawSynthwaveCar(ctx, w, h) {
        const horizon = h * 0.4;

        // Sky
        const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
        skyGradient.addColorStop(0, '#000015');
        skyGradient.addColorStop(0.5, '#1a0040');
        skyGradient.addColorStop(1, '#ff0066');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, horizon);

        this.drawStars(ctx, w, h * 0.25);

        // Sun at horizon
        const sunGradient = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, 60);
        sunGradient.addColorStop(0, '#ffff00');
        sunGradient.addColorStop(0.5, '#ff6600');
        sunGradient.addColorStop(1, '#ff0066');
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(w / 2, horizon, 50, Math.PI, 0);
        ctx.fill();

        // Road
        ctx.fillStyle = '#1a0020';
        ctx.beginPath();
        ctx.moveTo(w / 2, horizon);
        ctx.lineTo(0, h);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Road lines
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([30, 20]);
        ctx.beginPath();
        ctx.moveTo(w / 2, horizon);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Road edges
        ctx.strokeStyle = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(w / 2, horizon);
        ctx.lineTo(w * 0.15, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w / 2, horizon);
        ctx.lineTo(w * 0.85, h);
        ctx.stroke();

        // Simple car silhouette
        const carY = h * 0.75;
        const carW = 80;
        const carH = 25;
        const carX = w / 2 - carW / 2 + Math.sin(this.time) * 10;

        ctx.fillStyle = '#0a0010';
        // Car body
        ctx.beginPath();
        ctx.moveTo(carX, carY);
        ctx.lineTo(carX + carW, carY);
        ctx.lineTo(carX + carW - 10, carY - carH);
        ctx.lineTo(carX + carW - 25, carY - carH - 10);
        ctx.lineTo(carX + 25, carY - carH - 10);
        ctx.lineTo(carX + 10, carY - carH);
        ctx.closePath();
        ctx.fill();

        // Tail lights
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(carX + 2, carY - 8, 6, 4);
        ctx.fillRect(carX + carW - 8, carY - 8, 6, 4);

        // Neon underglow
        ctx.globalAlpha = 0.5;
        const glowGradient = ctx.createRadialGradient(carX + carW / 2, carY + 5, 0, carX + carW / 2, carY + 5, 60);
        glowGradient.addColorStop(0, '#ff00ff');
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.fillRect(carX - 20, carY, carW + 40, 20);
        ctx.globalAlpha = 1;
    }

    // ==================== ORIGINAL SCENES ====================

    // Scene 1: Distant Planet
    drawPlanet(ctx, w, h) {
        this.drawStars(ctx, w, h);

        // Large planet
        const planetX = w * 0.75;
        const planetY = h * 0.6;
        const planetR = Math.min(w, h) * 0.25;

        // Planet body
        const gradient = ctx.createRadialGradient(
            planetX - planetR * 0.3, planetY - planetR * 0.3, 0,
            planetX, planetY, planetR
        );
        gradient.addColorStop(0, '#4a6fa5');
        gradient.addColorStop(0.5, '#2d4a6f');
        gradient.addColorStop(1, '#1a2d45');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
        ctx.fill();

        // Planet rings
        ctx.strokeStyle = '#6a8caf';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(planetX, planetY, planetR * 1.5, planetR * 0.3, -0.2, 0, Math.PI * 2);
        ctx.stroke();

        // Small moon
        ctx.fillStyle = '#8899aa';
        ctx.beginPath();
        ctx.arc(planetX - planetR * 1.2, planetY - planetR * 0.8, planetR * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    // Scene 2: Solar System
    drawSolarSystem(ctx, w, h) {
        this.drawStars(ctx, w, h);

        const centerX = w * 0.3;
        const centerY = h * 0.5;

        // Sun
        const sunGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 40);
        sunGradient.addColorStop(0, '#ffdd44');
        sunGradient.addColorStop(0.5, '#ffaa22');
        sunGradient.addColorStop(1, '#ff6600');
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 35, 0, Math.PI * 2);
        ctx.fill();

        // Orbits and planets
        const planets = [
            { orbit: 70, size: 6, color: '#aa8866', speed: 0.8 },
            { orbit: 110, size: 10, color: '#ddaa66', speed: 0.5 },
            { orbit: 160, size: 12, color: '#4488cc', speed: 0.3 },
            { orbit: 210, size: 8, color: '#cc6644', speed: 0.2 },
            { orbit: 280, size: 20, color: '#ddcc99', speed: 0.1 },
        ];

        planets.forEach(planet => {
            // Orbit line
            ctx.strokeStyle = '#334455';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, centerY, planet.orbit, 0, Math.PI * 2);
            ctx.stroke();

            // Planet
            const angle = this.time * planet.speed;
            const px = centerX + Math.cos(angle) * planet.orbit;
            const py = centerY + Math.sin(angle) * planet.orbit;
            ctx.fillStyle = planet.color;
            ctx.beginPath();
            ctx.arc(px, py, planet.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // Scene 3: City Skyline
    drawCityscape(ctx, w, h) {
        const baseY = h * 0.85;

        // Background buildings (far)
        ctx.fillStyle = '#1a2030';
        for (let i = 0; i < 20; i++) {
            const bw = 30 + Math.random() * 50;
            const bh = 80 + Math.random() * 150;
            const bx = i * (w / 15) - 20;
            ctx.fillRect(bx, baseY - bh, bw, bh);
        }

        // Foreground buildings
        ctx.fillStyle = '#0d1520';
        for (let i = 0; i < 15; i++) {
            const bw = 40 + Math.random() * 60;
            const bh = 120 + Math.random() * 200;
            const bx = i * (w / 12) - 30;
            ctx.fillRect(bx, baseY - bh, bw, bh);

            // Windows
            ctx.fillStyle = '#334466';
            for (let wy = baseY - bh + 15; wy < baseY - 20; wy += 20) {
                for (let wx = bx + 8; wx < bx + bw - 8; wx += 15) {
                    if (Math.random() > 0.3) {
                        const windowLight = Math.random() > 0.7 ? '#ffdd88' : '#334466';
                        ctx.fillStyle = windowLight;
                        ctx.fillRect(wx, wy, 8, 12);
                    }
                }
            }
            ctx.fillStyle = '#0d1520';
        }

        // Animated car lights on ground
        const carX = ((this.time * 50) % (w + 100)) - 50;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(carX, baseY - 5, 4, 2);
        ctx.fillStyle = '#ffff44';
        ctx.fillRect(w - carX, baseY - 5, 4, 2);
    }

    // Scene 4: Enchanted Forest
    drawForest(ctx, w, h) {
        const baseY = h * 0.9;

        // Moon
        ctx.fillStyle = '#ddeeff';
        ctx.beginPath();
        ctx.arc(w * 0.8, h * 0.15, 40, 0, Math.PI * 2);
        ctx.fill();

        // Background trees (misty)
        ctx.fillStyle = '#0a1510';
        for (let i = 0; i < 30; i++) {
            const tx = Math.random() * w;
            const th = 100 + Math.random() * 150;
            this.drawTree(ctx, tx, baseY - 50, th * 0.7, '#0a1510');
        }

        // Midground trees
        for (let i = 0; i < 20; i++) {
            const tx = Math.random() * w;
            const th = 150 + Math.random() * 200;
            this.drawTree(ctx, tx, baseY - 20, th * 0.8, '#061008');
        }

        // Foreground trees
        for (let i = 0; i < 12; i++) {
            const tx = i * (w / 10) + Math.random() * 30;
            const th = 200 + Math.random() * 250;
            this.drawTree(ctx, tx, baseY, th, '#030805');
        }

        // Fireflies
        for (let i = 0; i < 20; i++) {
            const fx = (Math.sin(this.time + i * 0.5) * 0.5 + 0.5) * w;
            const fy = h * 0.3 + Math.cos(this.time * 0.7 + i) * h * 0.3;
            const alpha = 0.3 + Math.sin(this.time * 3 + i) * 0.3;
            ctx.fillStyle = `rgba(200, 255, 100, ${alpha})`;
            ctx.beginPath();
            ctx.arc(fx, fy, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawTree(ctx, x, baseY, height, color) {
        ctx.fillStyle = color;
        // Trunk
        ctx.fillRect(x - 5, baseY - height * 0.3, 10, height * 0.3);
        // Foliage layers
        ctx.beginPath();
        ctx.moveTo(x, baseY - height);
        ctx.lineTo(x + height * 0.3, baseY - height * 0.3);
        ctx.lineTo(x - height * 0.3, baseY - height * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    // Scene 5: Night Highway / Freeway
    drawFreeway(ctx, w, h) {
        this.drawStars(ctx, w, h);

        const horizon = h * 0.45;
        const vanishX = w * 0.5;

        // Road
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(0, h);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Road lines
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(w * 0.2, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(w * 0.8, h);
        ctx.stroke();

        // Dashed center line
        ctx.strokeStyle = '#ffff00';
        ctx.setLineDash([20, 30]);
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(vanishX, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated car tail lights going into distance
        for (let i = 0; i < 5; i++) {
            const progress = ((this.time * 0.2 + i * 0.2) % 1);
            const y = horizon + (h - horizon) * progress;
            const spread = progress * 0.15;
            const lx = vanishX - w * spread * 0.3;
            const rx = vanishX + w * spread * 0.3;
            const size = 2 + progress * 4;

            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(lx - 5, y, size, 0, Math.PI * 2);
            ctx.arc(lx + 5, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Oncoming headlights
        for (let i = 0; i < 3; i++) {
            const progress = ((this.time * 0.15 + i * 0.3) % 1);
            const y = horizon + (h - horizon) * progress;
            const spread = progress * 0.15;
            const x = vanishX + w * spread * 0.25;
            const size = 1 + progress * 3;

            ctx.fillStyle = '#ffffcc';
            ctx.beginPath();
            ctx.arc(x - 3, y, size, 0, Math.PI * 2);
            ctx.arc(x + 3, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Scene 6: Golden Sunset
    drawSunset(ctx, w, h) {
        // Sky gradient
        const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        skyGradient.addColorStop(0, '#1a0a20');
        skyGradient.addColorStop(0.3, '#4a1a30');
        skyGradient.addColorStop(0.6, '#8a3a20');
        skyGradient.addColorStop(0.8, '#cc6620');
        skyGradient.addColorStop(1, '#ffaa30');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, h * 0.6);

        // Sun
        const sunY = h * 0.55;
        const sunGradient = ctx.createRadialGradient(w * 0.5, sunY, 0, w * 0.5, sunY, 60);
        sunGradient.addColorStop(0, '#ffee88');
        sunGradient.addColorStop(0.5, '#ffaa44');
        sunGradient.addColorStop(1, '#ff6600');
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(w * 0.5, sunY, 50, 0, Math.PI * 2);
        ctx.fill();

        // Water/ground
        ctx.fillStyle = '#0a0808';
        ctx.fillRect(0, h * 0.6, w, h * 0.4);

        // Sun reflection on water
        ctx.fillStyle = '#ff660033';
        ctx.beginPath();
        ctx.moveTo(w * 0.4, h * 0.6);
        ctx.lineTo(w * 0.6, h * 0.6);
        ctx.lineTo(w * 0.55, h);
        ctx.lineTo(w * 0.45, h);
        ctx.closePath();
        ctx.fill();

        // Clouds
        this.drawCloud(ctx, w * 0.2, h * 0.2, 80, '#2a1520');
        this.drawCloud(ctx, w * 0.7, h * 0.15, 100, '#3a2530');
        this.drawCloud(ctx, w * 0.85, h * 0.3, 60, '#4a2a35');
    }

    drawCloud(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y - size * 0.1, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
        ctx.arc(x + size * 0.3, y + size * 0.2, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Scene 7: Mountain Range
    drawMountains(ctx, w, h) {
        this.drawStars(ctx, w, h, '#aaccff');

        // Moon
        ctx.fillStyle = '#ddeeff';
        ctx.beginPath();
        ctx.arc(w * 0.85, h * 0.12, 35, 0, Math.PI * 2);
        ctx.fill();

        // Far mountains
        ctx.fillStyle = '#1a2535';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, h * 0.5);
        ctx.lineTo(w * 0.15, h * 0.35);
        ctx.lineTo(w * 0.3, h * 0.45);
        ctx.lineTo(w * 0.45, h * 0.3);
        ctx.lineTo(w * 0.6, h * 0.42);
        ctx.lineTo(w * 0.75, h * 0.28);
        ctx.lineTo(w * 0.9, h * 0.4);
        ctx.lineTo(w, h * 0.35);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Snow caps
        ctx.fillStyle = '#3a4555';
        ctx.beginPath();
        ctx.moveTo(w * 0.45, h * 0.3);
        ctx.lineTo(w * 0.42, h * 0.36);
        ctx.lineTo(w * 0.48, h * 0.36);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(w * 0.75, h * 0.28);
        ctx.lineTo(w * 0.72, h * 0.35);
        ctx.lineTo(w * 0.78, h * 0.35);
        ctx.closePath();
        ctx.fill();

        // Near mountains
        ctx.fillStyle = '#0d1520';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, h * 0.6);
        ctx.lineTo(w * 0.2, h * 0.45);
        ctx.lineTo(w * 0.35, h * 0.55);
        ctx.lineTo(w * 0.5, h * 0.4);
        ctx.lineTo(w * 0.7, h * 0.52);
        ctx.lineTo(w * 0.85, h * 0.38);
        ctx.lineTo(w, h * 0.5);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
    }

    // Scene 8: Deep Ocean
    drawOcean(ctx, w, h) {
        // Water gradient
        const waterGradient = ctx.createLinearGradient(0, 0, 0, h);
        waterGradient.addColorStop(0, '#0a1520');
        waterGradient.addColorStop(0.3, '#0a2030');
        waterGradient.addColorStop(0.7, '#051525');
        waterGradient.addColorStop(1, '#020a10');
        ctx.fillStyle = waterGradient;
        ctx.fillRect(0, 0, w, h);

        // Light rays from surface
        ctx.fillStyle = '#1a3045';
        for (let i = 0; i < 5; i++) {
            const rayX = w * 0.2 + i * w * 0.15;
            ctx.beginPath();
            ctx.moveTo(rayX - 20, 0);
            ctx.lineTo(rayX + 20, 0);
            ctx.lineTo(rayX + 80 + Math.sin(this.time + i) * 20, h);
            ctx.lineTo(rayX - 80 + Math.sin(this.time + i) * 20, h);
            ctx.closePath();
            ctx.globalAlpha = 0.3;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Bubbles
        for (let i = 0; i < 25; i++) {
            const bx = (i * 73 + this.time * 20) % w;
            const by = h - ((this.time * 30 + i * 47) % h);
            const size = 3 + (i % 5);
            ctx.strokeStyle = '#2a4555';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(bx, by, size, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Jellyfish
        for (let i = 0; i < 3; i++) {
            const jx = w * 0.2 + i * w * 0.3;
            const jy = h * 0.3 + Math.sin(this.time * 0.5 + i) * 50 + i * 100;
            this.drawJellyfish(ctx, jx, jy, 25 + i * 10);
        }
    }

    drawJellyfish(ctx, x, y, size) {
        // Body
        ctx.fillStyle = '#2a4060';
        ctx.beginPath();
        ctx.arc(x, y, size, Math.PI, 0);
        ctx.fill();

        // Tentacles
        ctx.strokeStyle = '#2a4060';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const tx = x - size * 0.6 + i * size * 0.3;
            ctx.beginPath();
            ctx.moveTo(tx, y);
            for (let j = 0; j < 4; j++) {
                const ty = y + j * 15;
                const wave = Math.sin(this.time * 2 + i + j * 0.5) * 5;
                ctx.lineTo(tx + wave, ty);
            }
            ctx.stroke();
        }
    }

    // Scene 9: Northern Lights / Aurora
    drawAurora(ctx, w, h) {
        this.drawStars(ctx, w, h);

        // Aurora bands
        const colors = [
            { color: '#00ff88', y: 0.15 },
            { color: '#00ffaa', y: 0.25 },
            { color: '#44ffaa', y: 0.35 },
            { color: '#00ff66', y: 0.2 },
            { color: '#22ffcc', y: 0.3 },
        ];

        colors.forEach((band, i) => {
            ctx.beginPath();
            ctx.moveTo(0, h * band.y);

            for (let x = 0; x <= w; x += 20) {
                const y = h * band.y +
                    Math.sin(x * 0.01 + this.time + i) * 30 +
                    Math.sin(x * 0.02 + this.time * 0.5) * 20;
                ctx.lineTo(x, y);
            }

            ctx.lineTo(w, h * 0.6);
            ctx.lineTo(0, h * 0.6);
            ctx.closePath();

            const gradient = ctx.createLinearGradient(0, h * band.y, 0, h * 0.6);
            gradient.addColorStop(0, band.color + '40');
            gradient.addColorStop(0.5, band.color + '20');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fill();
        });

        // Snowy ground
        ctx.fillStyle = '#1a2530';
        ctx.fillRect(0, h * 0.85, w, h * 0.15);

        // Pine trees silhouette
        for (let i = 0; i < 15; i++) {
            const tx = i * (w / 12);
            const th = 40 + Math.random() * 60;
            ctx.fillStyle = '#0a1015';
            ctx.beginPath();
            ctx.moveTo(tx, h * 0.85);
            ctx.lineTo(tx + 15, h * 0.85);
            ctx.lineTo(tx + 7.5, h * 0.85 - th);
            ctx.closePath();
            ctx.fill();
        }
    }

    // Scene 10: Cosmic Nebula
    drawNebula(ctx, w, h) {
        this.drawStars(ctx, w, h);

        // Nebula clouds
        const nebulaColors = [
            { x: 0.3, y: 0.4, r: 200, color1: '#4a1a60', color2: '#2a0a40' },
            { x: 0.6, y: 0.3, r: 250, color1: '#1a3a60', color2: '#0a1a40' },
            { x: 0.5, y: 0.6, r: 180, color1: '#602a40', color2: '#400a20' },
            { x: 0.7, y: 0.7, r: 150, color1: '#2a4a50', color2: '#0a2030' },
        ];

        nebulaColors.forEach(nebula => {
            const gradient = ctx.createRadialGradient(
                w * nebula.x, h * nebula.y, 0,
                w * nebula.x, h * nebula.y, nebula.r
            );
            gradient.addColorStop(0, nebula.color1 + '60');
            gradient.addColorStop(0.5, nebula.color2 + '40');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(w * nebula.x, h * nebula.y, nebula.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // Brighter stars in nebula
        for (let i = 0; i < 30; i++) {
            const sx = w * 0.2 + Math.random() * w * 0.6;
            const sy = h * 0.2 + Math.random() * h * 0.6;
            const size = 1 + Math.random() * 2;
            const alpha = 0.5 + Math.sin(this.time * 2 + i) * 0.3;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Scene 11: Desert Dunes
    drawDesert(ctx, w, h) {
        // Night sky gradient
        const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.5);
        skyGradient.addColorStop(0, '#0a0a15');
        skyGradient.addColorStop(1, '#1a1520');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, w, h * 0.5);

        this.drawStars(ctx, w, h * 0.5);

        // Crescent moon
        ctx.fillStyle = '#ddeeff';
        ctx.beginPath();
        ctx.arc(w * 0.8, h * 0.15, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a0a15';
        ctx.beginPath();
        ctx.arc(w * 0.8 + 10, h * 0.15 - 5, 22, 0, Math.PI * 2);
        ctx.fill();

        // Dunes
        ctx.fillStyle = '#1a1510';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.quadraticCurveTo(w * 0.2, h * 0.4, w * 0.35, h * 0.6);
        ctx.quadraticCurveTo(w * 0.5, h * 0.75, w * 0.65, h * 0.5);
        ctx.quadraticCurveTo(w * 0.8, h * 0.3, w, h * 0.55);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Foreground dune
        ctx.fillStyle = '#0d0a08';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.quadraticCurveTo(w * 0.3, h * 0.6, w * 0.5, h * 0.75);
        ctx.quadraticCurveTo(w * 0.7, h * 0.85, w, h * 0.7);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
    }

    // Scene 12: Neon Tokyo
    drawTokyo(ctx, w, h) {
        const baseY = h * 0.9;

        // Dark sky
        ctx.fillStyle = '#0a0510';
        ctx.fillRect(0, 0, w, baseY);

        // Background buildings with neon
        for (let i = 0; i < 25; i++) {
            const bw = 25 + Math.random() * 45;
            const bh = 100 + Math.random() * 200;
            const bx = i * (w / 18) - 10;

            ctx.fillStyle = '#0d0815';
            ctx.fillRect(bx, baseY - bh, bw, bh);

            // Neon signs
            if (Math.random() > 0.5) {
                const neonColors = ['#ff0066', '#00ffff', '#ff6600', '#ff00ff', '#00ff66'];
                const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
                const ny = baseY - bh + 20 + Math.random() * 50;

                ctx.fillStyle = neonColor;
                ctx.globalAlpha = 0.6 + Math.sin(this.time * 3 + i) * 0.2;
                ctx.fillRect(bx + 3, ny, bw - 6, 8);
                ctx.globalAlpha = 1;
            }

            // Windows
            for (let wy = baseY - bh + 30; wy < baseY - 15; wy += 15) {
                for (let wx = bx + 4; wx < bx + bw - 4; wx += 10) {
                    if (Math.random() > 0.4) {
                        const colors = ['#332244', '#442233', '#ffaa00', '#ff6688', '#44ffff'];
                        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                        ctx.globalAlpha = 0.5;
                        ctx.fillRect(wx, wy, 6, 8);
                        ctx.globalAlpha = 1;
                    }
                }
            }
        }

        // Rain effect
        ctx.strokeStyle = '#4466aa';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 100; i++) {
            const rx = (i * 17 + this.time * 200) % w;
            const ry = (i * 23 + this.time * 500) % h;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 2, ry + 15);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Ground reflection
        ctx.fillStyle = '#0a0510';
        ctx.fillRect(0, baseY, w, h - baseY);
    }
}

// Export singleton
const backgrounds = new BackgroundSystem();
export default backgrounds;
