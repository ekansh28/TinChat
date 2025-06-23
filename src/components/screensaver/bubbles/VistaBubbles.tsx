import React, { useEffect, useRef } from 'react';

interface Bubble {
  x: number;
  y: number;
  size: number;
  velocity: { x: number; y: number };
  image: HTMLImageElement;
  targetImage: HTMLImageElement;
  imageProgress: number;
  opacity: number;
}

const bubbleImagePaths = [
  '/img/bubble-red.png',
  '/img/bubble-blue.png',
  '/img/bubble-purple.png'
];

declare global {
  interface Window {
    p5: any;
  }
}

// Utility functions
function isCollided(particle: Bubble, otherParticle: Bubble) {
  const dx = Math.abs(particle.x - otherParticle.x);
  const dy = Math.abs(particle.y - otherParticle.y);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (particle.size + otherParticle.size) / 2;
}

function rotate(velocity: { x: number; y: number }, angle: number) {
  return {
    x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
    y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle),
  };
}

function resolveCollision(particle: Bubble, otherParticle: Bubble) {
  const xVelocityDiff = particle.velocity.x - otherParticle.velocity.x;
  const yVelocityDiff = particle.velocity.y - otherParticle.velocity.y;

  const xDist = otherParticle.x - particle.x;
  const yDist = otherParticle.y - particle.y;

  if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
    const angle = -Math.atan2(yDist, xDist);
    const m1 = 1;
    const m2 = 1;

    const u1 = rotate(particle.velocity, angle);
    const u2 = rotate(otherParticle.velocity, angle);

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

    particle.velocity.x = vFinal1.x;
    particle.velocity.y = vFinal1.y;
    otherParticle.velocity.x = vFinal2.x;
    otherParticle.velocity.y = vFinal2.y;
  }
}

const VistaBubbles: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Instance = useRef<any>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const p5LoadedRef = useRef(false);
  const bubbleImagesRef = useRef<HTMLImageElement[]>([]);
  const targetImageIndexRef = useRef(0);
  const colorChangeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleInteraction = (e: KeyboardEvent | MouseEvent) => {
      if (e.type === 'mousemove') return;
      if (containerRef.current) {
        containerRef.current.style.display = 'none';
      }
    };

    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('mousedown', handleInteraction);

    return () => {
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || p5LoadedRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/p5@1.11.8/lib/p5.min.js';
    script.onload = () => {
      p5LoadedRef.current = true;
      initializeP5();
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
      if (colorChangeIntervalRef.current) {
        clearInterval(colorChangeIntervalRef.current);
      }
    };
  }, []);

  const initializeP5 = () => {
    if (!containerRef.current || !window.p5) return;

    const sketch = (p: any) => {
      let bubbleAssets: HTMLImageElement[] = [];

      p.preload = () => {
        bubbleAssets = bubbleImagePaths.map(path => p.loadImage(path));
      };

      p.setup = () => {
        const container = containerRef.current;
        if (!container || bubbleAssets.length === 0) return;

        const w = container.offsetWidth;
        const h = container.offsetHeight;

        const canvas = p.createCanvas(w, h);
        canvas.style('display', 'block');
        canvas.style('position', 'fixed');
        canvas.style('top', '0');
        canvas.style('left', '0');
        canvas.style('z-index', '9999');
        canvas.style('pointer-events', 'none');
        
        p.background(0, 0, 0, 0);

        // Initialize images reference
        bubbleImagesRef.current = bubbleAssets;
        
        // Change target image every 5 seconds
        colorChangeIntervalRef.current = setInterval(() => {
          targetImageIndexRef.current = 
            (targetImageIndexRef.current + 1) % bubbleAssets.length;
        }, 5000);

        // Create initial bubbles
        bubblesRef.current = [];
        for (let i = 0; i < 12; i++) {
          setTimeout(() => createBubble(p, w, h), i * 800);
        }

        // Keep creating new bubbles periodically
        setInterval(() => createBubble(p, w, h), 2000);
      };

      const createBubble = (p: any, w: number, h: number) => {
        const size = p.random(40, Math.min(w, h) / 3);
        const x = -size/2;
        const y = -size/2;
        
        // Throw the bubble with random direction (mostly toward bottom-right)
        const angle = p.random(-Math.PI/4, Math.PI/4);
        const speed = p.random(1.5, 3.5);
        const velocity = {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        };

        const initialImageIndex = Math.floor(p.random(bubbleImagesRef.current.length));
        const initialImage = bubbleImagesRef.current[initialImageIndex];
        
        bubblesRef.current.push({
          x,
          y,
          size,
          velocity,
          image: initialImage,
          targetImage: initialImage,
          imageProgress: 1,
          opacity: 0 // Start transparent and fade in
        });
      };

      p.draw = () => {
        p.clear(0, 0, 0, 0);

        bubblesRef.current.forEach((bubble, index) => {
          // Update image transition
          if (bubble.imageProgress < 1) {
            bubble.imageProgress += 0.01;
          } else if (Math.random() < 0.005 && bubbleImagesRef.current.length > 0) {
            // Occasionally set new target image
            bubble.targetImage = bubbleImagesRef.current[targetImageIndexRef.current];
            bubble.imageProgress = 0;
          }

          // Fade in new bubbles
          if (bubble.opacity < 1) {
            bubble.opacity += 0.02;
          }

          // Draw bubble with current image
          p.tint(255, bubble.opacity * 255);
          p.imageMode(p.CENTER);
          
          // Cross-fade between images during transition
          if (bubble.imageProgress < 1) {
            p.push();
            p.translate(bubble.x, bubble.y);
            
            // Draw old image fading out
            p.tint(255, (1 - bubble.imageProgress) * bubble.opacity * 255);
            p.image(bubble.image, 0, 0, bubble.size, bubble.size);
            
            // Draw new image fading in
            p.tint(255, bubble.imageProgress * bubble.opacity * 255);
            p.image(bubble.targetImage, 0, 0, bubble.size, bubble.size);
            
            p.pop();
          } else {
            p.image(bubble.image, bubble.x, bubble.y, bubble.size, bubble.size);
          }

          updateBubble(bubble, index);
        });

        // Remove bubbles that are far off screen
        bubblesRef.current = bubblesRef.current.filter(bubble => {
          return (
            bubble.x < p.width + bubble.size * 2 &&
            bubble.x > -bubble.size * 2 &&
            bubble.y < p.height + bubble.size * 2 &&
            bubble.y > -bubble.size * 2
          );
        });
      };

      const updateBubble = (bubble: Bubble, index: number) => {
        const container = containerRef.current;
        if (!container) return;

        const w = container.offsetWidth;
        const h = container.offsetHeight;
        const { size, velocity } = bubble;

        bubble.x += velocity.x;
        bubble.y += velocity.y;

        // Bounce off walls with some energy loss
        if (bubble.x > w - size/2 || bubble.x < size/2) {
          bubble.velocity.x *= -0.9;
          bubble.x = p.constrain(bubble.x, size/2, w - size/2);
        }
        if (bubble.y > h - size/2 || bubble.y < size/2) {
          bubble.velocity.y *= -0.9;
          bubble.y = p.constrain(bubble.y, size/2, h - size/2);
        }

        // Add slight gravity
        bubble.velocity.y += 0.03;

        // Update image reference when transition completes
        if (bubble.imageProgress >= 1 && bubble.image !== bubble.targetImage) {
          bubble.image = bubble.targetImage;
        }

        // Collision with other bubbles
        for (let i = index + 1; i < bubblesRef.current.length; i++) {
          const otherBubble = bubblesRef.current[i];
          if (isCollided(bubble, otherBubble)) {
            resolveCollision(bubble, otherBubble);
          }
        }
      };
    };

    p5Instance.current = new window.p5(sketch, containerRef.current);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    />
  );
};

export default VistaBubbles;

// hi