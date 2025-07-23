import { useEffect, useRef } from "react";

declare global {
  interface Window {
    p5: any;
  }
}

// Types for our bubble objects
type Bubble = {
  x: number;
  y: number;
  size: number;
  velocity: { x: number; y: number };
  img: any;
  alpha: number;
};

// Types for collision functions
type Velocity = { x: number; y: number };
type Particle = { x: number; y: number; size: number; velocity: Velocity };

const VistaBubbles = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const p5InstanceRef = useRef<any>(null);

  // Collision detection and resolution functions from utils.js
  const isCollided = (p1: Particle, p2: Particle): boolean => {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (p1.size + p2.size) / 2;
  };

  const rotate = (velocity: Velocity, angle: number): Velocity => {
    return {
      x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
      y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle),
    };
  };

  const resolveCollision = (p1: Particle, p2: Particle): void => {
    const xVelocityDiff = p1.velocity.x - p2.velocity.x;
    const yVelocityDiff = p1.velocity.y - p2.velocity.y;
    const xDist = p2.x - p1.x;
    const yDist = p2.y - p1.y;

    if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
      const angle = -Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const m1 = 1, m2 = 1;

      const u1 = rotate(p1.velocity, angle);
      const u2 = rotate(p2.velocity, angle);

      const v1 = {
        x: (u1.x * (m1 - m2)) / (m1 + m2) + (u2.x * 2 * m2) / (m1 + m2),
        y: u1.y,
      };
      const v2 = {
        x: (u2.x * (m1 - m2)) / (m1 + m2) + (u1.x * 2 * m2) / (m1 + m2),
        y: u2.y,
      };

      const vFinal1 = rotate(v1, -angle);
      const vFinal2 = rotate(v2, -angle);

      p1.velocity.x = vFinal1.x;
      p1.velocity.y = vFinal1.y;
      p2.velocity.x = vFinal2.x;
      p2.velocity.y = vFinal2.y;
    }
  };

  // Bubble drawing and updating functions inspired by Bubbles.js
  const drawBubble = (p5: any, bubble: Bubble): void => {
    p5.push();
    p5.translate(bubble.x + bubble.size / 2, bubble.y + bubble.size / 2);

    if (bubble.img && bubble.img.width > 0) {
      p5.imageMode(p5.CENTER);
      p5.tint(255, bubble.alpha * 255);
      p5.image(bubble.img, 0, 0, bubble.size, bubble.size);
    }

    p5.pop();
  };

  const updateBubble = (p5: any, bubble: Bubble, index: number, bubbles: Bubble[]): void => {
    bubble.x += bubble.velocity.x;
    bubble.y += bubble.velocity.y;

    if (bubble.alpha < 1) bubble.alpha += 0.01;

    // Boundary collision - modified from Bubbles.js
    if (bubble.x < 0 || bubble.x + bubble.size > p5.width) {
      bubble.velocity.x *= -1;
    }
    if (bubble.y < 0 || bubble.y + bubble.size > p5.height) {
      bubble.velocity.y *= -1;
    }

    // Bubble collision detection - using the utils.js functions
    for (let i = 0; i < bubbles.length; i++) {
      if (i === index) continue;
      const other = bubbles[i];
      if (isCollided(bubble, other)) {
        resolveCollision(bubble, other);
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/p5@1.11.8/lib/p5.min.js";
    script.onload = () => {
      const checkP5 = () => {
        if (window.p5) {
          initP5();
        } else {
          setTimeout(checkP5, 100);
        }
      };
      checkP5();
    };
    document.body.appendChild(script);

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
      document.body.removeChild(script);
    };
  }, []);

  const initP5 = () => {
    if (!containerRef.current || !window.p5) return;

    const sketch = (p5: any) => {
      let bubbles: Bubble[] = [];
      let images: any[] = [];

      p5.setup = () => {
        const canvas = p5.createCanvas(
          containerRef.current?.offsetWidth || window.innerWidth,
          containerRef.current?.offsetHeight || window.innerHeight
        );
        canvas.parent(containerRef.current);

        // Load images
        images = [
          p5.loadImage("/img/bubble-blue.png"),
          p5.loadImage("/img/bubble-purple.png"),
          p5.loadImage("/img/bubble-red.png"),
        ];

        // Create bubbles with staggered timing - similar to Bubbles.js but improved
        for (let i = 0; i < 16; i++) {
          setTimeout(() => {
            const size = p5.random(60, 120);
            const x = p5.random(0, p5.width - size);
            const y = p5.random(p5.height / 2, p5.height - size);
            const velocity = {
              x: p5.random(-0.5, 0.5),
              y: p5.random(-1.2, -0.3),
            };
            const img = images[Math.floor(p5.random(images.length))];
            bubbles.push({ x, y, size, velocity, img, alpha: 0 });
          }, i * 300);
        }
      };

      p5.draw = () => {
        p5.clear();

        for (let i = 0; i < bubbles.length; i++) {
          updateBubble(p5, bubbles[i], i, bubbles);
          drawBubble(p5, bubbles[i]);
        }
      };

      p5.windowResized = () => {
        p5.resizeCanvas(
          containerRef.current?.offsetWidth || window.innerWidth,
          containerRef.current?.offsetHeight || window.innerHeight
        );
      };
    };

    p5InstanceRef.current = new window.p5(sketch);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        background: "transparent",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    />
  );
};

export default VistaBubbles;