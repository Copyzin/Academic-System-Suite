import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const NebulaBackground = () => {
  // Referencia para acessar o elemento canvas diretamente.
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    // Mantem tamanho do canvas sincronizado com a janela.
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Posicao inicial do mouse (centro da tela) para dirigir o efeito de luz/interacao.
    let mouse = { x: width / 2, y: height / 2 };

    type RGB = { r: number; g: number; b: number };
    type RGBA = { r: number; g: number; b: number; a: number };

    const hexToRgb = (hex: string): RGB => {
      const normalized = hex.replace('#', '');
      const intValue = Number.parseInt(normalized, 16);
      return {
        r: (intValue >> 16) & 255,
        g: (intValue >> 8) & 255,
        b: intValue & 255,
      };
    };

    const luminance = (color: RGB): number => {
      return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
    };

    const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

    const rgbString = (color: RGB): string =>
      `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;

    const jitterRgb = (color: RGB, amount: number): RGB => ({
      r: clamp(color.r + (Math.random() - 0.5) * amount * 2, 0, 255),
      g: clamp(color.g + (Math.random() - 0.5) * amount * 2, 0, 255),
      b: clamp(color.b + (Math.random() - 0.5) * amount * 2, 0, 255),
    });

    const mixValue = (from: number, to: number, t: number): number => from + (to - from) * t;

    const mixColor = (from: RGB, to: RGB, t: number): RGB => ({
      r: mixValue(from.r, to.r, t),
      g: mixValue(from.g, to.g, t),
      b: mixValue(from.b, to.b, t),
    });

    const lerpRgba = (from: RGBA, to: RGBA, t: number): RGBA => ({
      r: mixValue(from.r, to.r, t),
      g: mixValue(from.g, to.g, t),
      b: mixValue(from.b, to.b, t),
      a: mixValue(from.a, to.a, t),
    });

    const rgbaString = (color: RGBA): string =>
      `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${color.a})`;

    // Paleta mais ampla com tons frios e quentes para dar variedade sem perder harmonia.
    const baseParticleColors = [
      '#05172A',
      '#0D2A45',
      '#154469',
      '#1F6788',
      '#2D8AA6',
      '#5CB8BF',
      '#90D3CC',
      '#D9ECEE',
      '#F1E5CC',
      '#F5C989',
      '#ECA16E',
      '#D87664',
      '#C95E6A',
      '#BFD2E0',
      '#8FB1C9',
      '#6C93B2',
    ];

    const colorPalette = baseParticleColors.map((hex) => {
      const rgb = hexToRgb(hex);
      return {
        hex,
        rgb,
        lum: luminance(rgb),
      };
    });

    // Estado dinamico do fundo para transicao suave entre tons claros/escuros.
    let bgInner: RGBA = { r: 20, g: 40, b: 66, a: 0.32 };
    let bgOuter: RGBA = { r: 8, g: 22, b: 40, a: 0.14 };
    let targetBgInner: RGBA = { ...bgInner };
    let targetBgOuter: RGBA = { ...bgOuter };
    let frameTick = 0;
    let animationFrameId: number | undefined;

    // Cada Particle representa um ponto luminoso na nebulosa.
    class Particle {
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      color: string;
      colorRGB: RGB;
      colorLum: number;

      constructor() {
        // Cria a particula em posicao aleatoria com velocidade e cor aleatorias.
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.radius = Math.random() * 1.5 + 0.5;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        const selected = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const variedColor = jitterRgb(selected.rgb, 14);
        this.colorRGB = variedColor;
        this.colorLum = luminance(variedColor);
        this.color = rgbString(variedColor);
      }

      update() {
        // Aplica uma repulsao suave do mouse alterando velocidade (evita flicker).
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        const mouseInfluence = 140;
        const mouseInfluenceSq = mouseInfluence * mouseInfluence;

        if (distSq < mouseInfluenceSq) {
          const dist = Math.sqrt(distSq);
          const safeDist = Math.max(dist, 1);
          const pushStrength = (1 - safeDist / mouseInfluence) * 0.18;
          this.vx += (dx / safeDist) * pushStrength;
          this.vy += (dy / safeDist) * pushStrength;
        }

        // Mantem uma velocidade maxima para evitar saltos bruscos.
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const maxSpeed = 1.2;
        if (speed > maxSpeed) {
          this.vx = (this.vx / speed) * maxSpeed;
          this.vy = (this.vy / speed) * maxSpeed;
        }

        // Move particula, rebate nas bordas e aplica amortecimento.
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        this.vx *= 0.99;
        this.vy *= 0.99;

        // Evita que a velocidade chegue a zero. Quando quase para, recebe um impulso leve e aleatorio.
        const speedAfterDamping = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const minSpeed = 0.04;
        if (speedAfterDamping < minSpeed) {
          const hasDirection = speedAfterDamping > 0.001;
          const baseAngle = hasDirection ? Math.atan2(this.vy, this.vx) : Math.random() * Math.PI * 2;
          const angle = baseAngle + (Math.random() - 0.5) * 0.45;
          const impulse = 0.035;
          this.vx += Math.cos(angle) * impulse;
          this.vy += Math.sin(angle) * impulse;
        }

        // Reaplica limite maximo apos o impulso.
        const finalSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (finalSpeed > maxSpeed) {
          this.vx = (this.vx / finalSpeed) * maxSpeed;
          this.vy = (this.vy / finalSpeed) * maxSpeed;
        }
      }

      draw() {
        // Desenha a particula atual no canvas.
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    // Quantidade de particulas proporcional ao tamanho da tela.
    let particles: Particle[] = [];

    // Reinicializa o array de particulas.
    function init() {
      particles = [];
      const particleCount = Math.floor((width * height) / 6000);
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    }

    // Calcula cor alvo do fundo a partir da media das particulas para manter contraste macro.
    function updateBackgroundTarget() {
      if (particles.length === 0) return;

      const sampleCount = Math.min(90, particles.length);
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumLum = 0;

      for (let i = 0; i < sampleCount; i++) {
        const particle = particles[Math.floor(Math.random() * particles.length)];
        sumR += particle.colorRGB.r;
        sumG += particle.colorRGB.g;
        sumB += particle.colorRGB.b;
        sumLum += particle.colorLum;
      }

      const avgColor: RGB = {
        r: sumR / sampleCount,
        g: sumG / sampleCount,
        b: sumB / sampleCount,
      };
      const avgLum = sumLum / sampleCount;

      // Base complementar para diferenciar o fundo das particulas sem ficar agressivo.
      const complementary: RGB = {
        r: 255 - avgColor.r,
        g: 255 - avgColor.g,
        b: 255 - avgColor.b,
      };
      const softenedComplementary = mixColor(complementary, { r: 134, g: 146, b: 156 }, 0.35);

      const particlesAreDark = avgLum < 0.5;

      if (particlesAreDark) {
        const inner = mixColor(softenedComplementary, { r: 246, g: 250, b: 253 }, 0.62);
        const outer = mixColor(softenedComplementary, { r: 214, g: 228, b: 238 }, 0.48);
        targetBgInner = { ...inner, a: 0.36 };
        targetBgOuter = { ...outer, a: 0.18 };
      } else {
        const inner = mixColor(softenedComplementary, { r: 12, g: 24, b: 42 }, 0.68);
        const outer = mixColor(softenedComplementary, { r: 22, g: 44, b: 68 }, 0.56);
        targetBgInner = { ...inner, a: 0.32 };
        targetBgOuter = { ...outer, a: 0.14 };
      }
    }

    // Loop principal da animacao: limpa, pinta fundo, atualiza/desenha particulas e conecta pontos.
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, width, height);

      // Atualiza alvo de cor em intervalos e aplica transicao suave quadro a quadro.
      frameTick += 1;
      if (frameTick % 24 === 0) updateBackgroundTarget();
      bgInner = lerpRgba(bgInner, targetBgInner, 0.02);
      bgOuter = lerpRgba(bgOuter, targetBgOuter, 0.02);

      // Fundo em gradiente radial que acompanha o mouse e varia conforme a nuvem de particulas.
      const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, Math.max(width, height));
      gradient.addColorStop(0, rgbaString(bgInner));
      gradient.addColorStop(1, rgbaString(bgOuter));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      connect();
    }

    // Liga particulas proximas com linhas semitransparentes.
    function connect() {
      const maxDistance = 170;
      const maxDistanceSq = maxDistance * maxDistance;

      for (let a = 0; a < particles.length; a++) {
        for (let b = a + 1; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < maxDistanceSq) {
            const opacityValue = 1 - distanceSq / maxDistanceSq;
            ctx.strokeStyle = `rgba(137, 194, 217, ${opacityValue * 0.65})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    }

    // Atualiza a posicao do mouse para controlar interacao e gradiente.
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    // Recalcula tamanho e particulas quando a janela muda.
    const handleResize = () => {
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    init();
    animate();

    // Limpeza de listeners para evitar vazamento de memoria ao desmontar.
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    // Canvas com fade-in suave usando framer-motion.
    <motion.canvas
      ref={canvasRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="absolute top-0 left-0 w-full h-full -z-10"
    />
  );
};

export default NebulaBackground;
