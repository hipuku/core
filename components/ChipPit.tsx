"use client";

import { useEffect, useRef } from "react";
import styles from "./ChipPit.module.css";

/** The vocabulary of the product, tumbling into a pit. */
const WORDS = [
  "PROPOSED",
  "ACCEPTED",
  "SUPERSEDED",
  "REJECTED",
  "DEPRECATED",
  "DECISION",
  "CONTEXT",
  "REVIEW",
  "APPROVE",
  "REVISE",
  "MARKDOWN",
  "MERMAID",
  "DRIFT",
  "REFERENCE",
  "RATIONALE",
  "MAINTAINER",
  "ADR",
];

/** Retro poster inks — the one place they all appear together. */
const COLORS = [
  "#E15E42",
  "#F78D2C",
  "#FFC700",
  "#15AD70",
  "#68D0CA",
  "#7193ED",
  "#BF9FF1",
  "#F9C3D6",
];

// Enough chips, cycling the vocabulary, to bank the pile up to roughly 45% of
// the pane. The words repeat; the colours keep the pile varied.
const COUNT = 90;
const CHIPS = Array.from({ length: COUNT }, (_, i) => ({
  word: WORDS[i % WORDS.length],
  color: COLORS[i % COLORS.length],
}));

export function ChipPit() {
  const stageRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;

    import("matter-js").then((Matter) => {
      if (cancelled || !stageRef.current) return;
      const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint } =
        Matter;

      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;

      const engine = Engine.create();
      engine.gravity.y = 1;

      const wall = (x: number, y: number, w: number, h: number) =>
        Bodies.rectangle(x, y, w, h, { isStatic: true });
      Composite.add(engine.world, [
        wall(width / 2, height + 40, width + 200, 80),
        wall(-40, height / 2, 80, height * 4),
        wall(width + 40, height / 2, 80, height * 4),
      ]);

      const els = chipRefs.current.filter(Boolean) as HTMLElement[];
      const bodies = els.map((el, i) => {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const body = Bodies.rectangle(
          width * 0.1 + Math.random() * width * 0.8,
          -40 - Math.floor(i / 7) * 52,
          w,
          h,
          {
            chamfer: { radius: h / 2 },
            restitution: 0.35,
            friction: 0.4,
            frictionStatic: 0.6,
          },
        );
        Body.setAngle(body, (Math.random() - 0.5) * 0.6);
        return body;
      });
      Composite.add(engine.world, bodies);

      const sync = () => {
        for (let i = 0; i < bodies.length; i += 1) {
          const b = bodies[i];
          const el = els[i];
          el.style.opacity = "1";
          el.style.transform = `translate(${b.position.x}px, ${b.position.y}px) rotate(${b.angle}rad) translate(-50%, -50%)`;
        }
      };

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        for (let i = 0; i < 600; i += 1) Engine.update(engine, 1000 / 60);
        sync();
        teardown = () => {
          Composite.clear(engine.world, false);
          Engine.clear(engine);
        };
        return;
      }

      const mouse = Mouse.create(stage);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, render: { visible: false } },
      });
      Composite.add(engine.world, mouseConstraint);
      // Keep the page scrollable when the pointer is over the pit.
      const wheel = (mouse as unknown as { mousewheel: EventListener }).mousewheel;
      mouse.element.removeEventListener("wheel", wheel);
      mouse.element.removeEventListener("DOMMouseScroll", wheel);

      const runner = Runner.create();
      Runner.run(runner, engine);
      let frame = requestAnimationFrame(function loop() {
        sync();
        frame = requestAnimationFrame(loop);
      });

      teardown = () => {
        cancelAnimationFrame(frame);
        Runner.stop(runner);
        Composite.clear(engine.world, false);
        Engine.clear(engine);
      };
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div className={styles.stage} ref={stageRef} aria-hidden>
      {CHIPS.map((chip, i) => (
        <span
          key={i}
          ref={(el) => {
            chipRefs.current[i] = el;
          }}
          className={styles.chip}
          style={{ background: chip.color }}
        >
          {chip.word}
        </span>
      ))}
    </div>
  );
}
