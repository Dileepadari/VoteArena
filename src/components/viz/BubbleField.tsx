import {
  forceCollide,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TallyEntry } from "../../../shared/types";
import { useElementSize } from "../../lib/useElementSize";
import styles from "./BubbleField.module.css";

const RAMP = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6", "--c7", "--c8"];

/** Colour by the option's fixed slot: stable as ranks change, and never two
 *  neighbours alike until a question runs past eight options. */
function colorFor(position: number): string {
  return `var(${RAMP[position % RAMP.length]})`;
}

interface Node extends SimulationNodeDatum {
  id: string;
  label: string;
  votes: number;
  /** Current drawn radius, eased toward `targetR` so counts grow rather than jump. */
  r: number;
  targetR: number;
  born: number;
  color: string;
}

export interface BubbleFieldProps {
  entries: TallyEntry[];
  /** Options the viewer has voted for, drawn with a marker ring. */
  highlighted?: string[];
  /** Hides counts while keeping the field visible, for "reveal at the end" questions. */
  showCounts?: boolean;
  onSelect?: (optionId: string) => void;
  className?: string;
}

/**
 * Votes as a live bubble field.
 *
 * Area is proportional to the vote count, so a bubble with twice the votes looks
 * twice as big rather than 1.4x as big - radius alone reads as a much smaller
 * lead than it is. The simulation is never allowed to fully settle: a small
 * residual alpha keeps everything drifting, which is what makes a live board
 * feel alive instead of like a static chart that occasionally redraws.
 */
export function BubbleField({
  entries,
  highlighted = [],
  showCounts = true,
  onSelect,
  className,
}: BubbleFieldProps) {
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const nodesRef = useRef<Map<string, Node>>(new Map());
  const simRef = useRef<Simulation<Node, undefined> | null>(null);
  /** Set by the simulation effect; re-runs the physics under the current motion mode. */
  const kickRef = useRef<(() => void) | null>(null);
  /** Repaints the current state without advancing the physics. */
  const paintRef = useRef<(() => void) | null>(null);
  const groupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const [visible, setVisible] = useState<string[]>([]);
  const [hovered, setHovered] = useState<{ id: string; x: number; y: number } | null>(null);

  const highlightSet = useMemo(() => new Set(highlighted), [highlighted]);
  const leaderId = entries.length && entries[0].votes > 0 ? entries[0].optionId : null;

  /* ----------------------------------------------------------- node sync */

  useEffect(() => {
    const { width, height } = size;
    if (!width || !height) return;

    const nodes = nodesRef.current;
    const seen = new Set<string>();
    const totalVotes = entries.reduce((sum, e) => sum + e.votes, 0);

    // Pick a scale so the bubbles together occupy a comfortable share of the
    // canvas: dense enough to feel full, loose enough that labels fit.
    const area = width * height;
    const maxR = Math.min(width, height) * (entries.length <= 3 ? 0.3 : 0.26);
    const minR = Math.max(9, Math.min(width, height) * 0.022);
    const k = totalVotes > 0 ? Math.sqrt((area * 0.38) / (Math.PI * totalVotes)) : 0;

    for (const entry of entries) {
      seen.add(entry.optionId);
      const targetR = Math.max(minR, Math.min(maxR, entry.votes > 0 ? k * Math.sqrt(entry.votes) : minR));
      const existing = nodes.get(entry.optionId);
      if (existing) {
        existing.votes = entry.votes;
        existing.label = entry.label;
        existing.targetR = targetR;
      } else {
        // New arrivals drop in from a random point just outside the middle, so a
        // write-in visibly joins the field rather than blinking into existence.
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.min(width, height) * 0.34;
        nodes.set(entry.optionId, {
          id: entry.optionId,
          label: entry.label,
          votes: entry.votes,
          r: 1,
          targetR,
          born: performance.now(),
          color: colorFor(entry.position),
          x: width / 2 + Math.cos(angle) * dist,
          y: height / 2 + Math.sin(angle) * dist,
          vx: 0,
          vy: 0,
        });
      }
    }

    for (const id of [...nodes.keys()]) {
      if (!seen.has(id)) nodes.delete(id);
    }

    const list = [...nodes.values()];
    setVisible(list.map((n) => n.id));

    const sim = simRef.current;
    if (sim) {
      sim.nodes(list);
      sim.alpha(0.55);
      kickRef.current?.();
    }
  }, [entries, size]);

  /* ------------------------------------------------------- simulation */

  useEffect(() => {
    const { width, height } = size;
    if (!width || !height) return;

    // Held onto because d3 reads the collision radius once per initialize, not
    // once per tick. Bubbles grow between tallies, so the force has to be told.
    const collide = forceCollide<Node>((d) => d.r + 3)
      .strength(1)
      .iterations(4);

    const sim = forceSimulation<Node>([...nodesRef.current.values()])
      .velocityDecay(0.32)
      .force("x", forceX(width / 2).strength(0.07))
      .force("y", forceY(height / 2).strength(0.08))
      .force("collide", collide)
      .alphaDecay(0.02);

    simRef.current = sim;

    const syncRadii = () => collide.initialize(sim.nodes(), Math.random);

    /**
     * Writes the current simulation state to the DOM.
     *
     * `settle` skips the easing and jumps every bubble to its final size. It is
     * used wherever an animation cannot or should not play: a hidden tab, where
     * requestAnimationFrame is suspended and an eased frame would freeze
     * half-grown, and readers who have asked for reduced motion.
     */
    const paint = (settle: boolean) => {
      const now = performance.now();
      const nodes = sim.nodes();

      for (const node of nodes) {
        // Ease the radius so a vote arriving reads as growth, not a redraw.
        node.r = settle ? node.targetR : node.r + (node.targetR - node.r) * 0.14;
      }
      syncRadii();

      for (const node of nodes) {
        const pad = node.r + 4;
        node.x = Math.max(pad, Math.min(width - pad, node.x ?? width / 2));
        node.y = Math.max(pad, Math.min(height - pad, node.y ?? height / 2));

        const group = groupRefs.current.get(node.id);
        if (!group) continue;

        group.setAttribute("transform", `translate(${node.x.toFixed(2)},${node.y.toFixed(2)})`);
        group.style.opacity = settle ? "1" : String(Math.min(1, (now - node.born) / 420));

        const body = group.querySelector<SVGCircleElement>("[data-role='body']");
        if (body) body.setAttribute("r", node.r.toFixed(2));

        const crown = group.querySelector<SVGCircleElement>("[data-role='crown']");
        if (crown) crown.setAttribute("r", (node.r + 7).toFixed(2));

        const mark = group.querySelector<SVGCircleElement>("[data-role='mark']");
        if (mark) mark.setAttribute("r", (node.r + 3).toFixed(2));

        const label = group.querySelector<SVGTextElement>("[data-role='label']");
        const count = group.querySelector<SVGTextElement>("[data-role='count']");
        const showCount = showCounts && node.r > 42;

        if (label) {
          // Width available across the middle of the circle, against the width
          // the name actually needs at 1em. Without this, a long name in a
          // medium bubble spills out both sides.
          const chars = Math.max(1, truncate(node.label).length);
          const usable = node.r * (showCount ? 1.66 : 1.76);
          // 0.62em per character is measured from the display face at its bold
          // weight; a lower estimate lets long names run past the circle edge.
          const byWidth = usable / (chars * 0.62);
          const size = Math.min(node.r * 0.36, byWidth, 34);
          const visible = size >= 10 && node.r > 22;
          label.style.opacity = visible ? "1" : "0";
          label.setAttribute("font-size", size.toFixed(1));
          label.setAttribute("y", showCount ? `${(-node.r * 0.04).toFixed(1)}` : `${(node.r * 0.13).toFixed(1)}`);
        }

        if (count) {
          count.style.opacity = showCount ? "1" : "0";
          count.setAttribute("font-size", `${Math.max(10, Math.min(node.r * 0.28, 26)).toFixed(1)}`);
          count.setAttribute("y", `${(node.r * 0.42).toFixed(1)}`);
        }
      }
    };

    /** Run the physics forward with no timers, then paint the resting state. */
    const settleNow = () => {
      // Sizes first: collision has to know how big everything ends up, or the
      // whole field collapses into one point and then inflates through itself.
      for (const node of sim.nodes()) node.r = node.targetR;
      syncRadii();
      sim.tick(400);
      paint(true);
    };

    let frame = 0;
    const loop = () => {
      paint(false);
      frame = requestAnimationFrame(loop);
    };

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const settled = () => reduceMotion || document.visibilityState === "hidden";
    paintRef.current = () => paint(settled());

    const start = () => {
      cancelAnimationFrame(frame);
      if (settled()) {
        sim.stop();
        settleNow();
      } else {
        // Never allowed to come fully to rest: the residual alpha is what makes
        // a live board drift instead of looking like a static chart.
        sim.alphaTarget(0.035).restart();
        frame = requestAnimationFrame(loop);
      }
    };

    kickRef.current = start;
    start();
    document.addEventListener("visibilitychange", start);

    return () => {
      kickRef.current = null;
      paintRef.current = null;
      document.removeEventListener("visibilitychange", start);
      cancelAnimationFrame(frame);
      sim.stop();
      simRef.current = null;
    };
  }, [size, showCounts]);

  useLayoutEffect(() => {
    paintRef.current?.();
  }, [visible]);

  /* --------------------------------------------------------- dragging */

  const dragging = useRef<{ id: string; pointerId: number } | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<SVGGElement>, id: string) => {
    const node = nodesRef.current.get(id);
    const sim = simRef.current;
    if (!node || !sim) return;
    dragging.current = { id, pointerId: event.pointerId };
    (event.currentTarget as SVGGElement).setPointerCapture(event.pointerId);
    sim.alphaTarget(0.32).restart();
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<SVGGElement>, id: string) => {
    const svg = (event.currentTarget as SVGGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setHovered({ id, x, y });

    if (dragging.current?.id !== id) return;
    const node = nodesRef.current.get(id);
    if (!node) return;
    node.fx = x;
    node.fy = y;
  }, []);

  const endDrag = useCallback((id: string) => {
    const node = nodesRef.current.get(id);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    // Back to the residual drift, not a dead stop.
    simRef.current?.alphaTarget(0.035);
    dragging.current = null;
  }, []);

  /* ------------------------------------------------------------ render */

  const hoveredNode = hovered ? nodesRef.current.get(hovered.id) : null;

  return (
    <div ref={wrapRef} className={`${styles.root} ${className ?? ""}`}>
      <svg className={styles.svg} role="img" aria-label={ariaSummary(entries, showCounts)}>
        {visible.map((id) => {
          const node = nodesRef.current.get(id);
          if (!node) return null;
          const isLeader = id === leaderId;
          const isMine = highlightSet.has(id);
          return (
            <g
              key={id}
              ref={(el) => {
                if (!el) {
                  groupRefs.current.delete(id);
                  return;
                }
                // Start invisible so a new bubble fades in rather than popping,
                // but only the first time: React re-runs inline ref callbacks on
                // every render, and resetting here would restart every fade.
                if (!el.style.opacity) el.style.opacity = "0";
                groupRefs.current.set(id, el);
              }}
              className={styles.node}
              data-active={hovered?.id === id}
              onPointerDown={(e) => onPointerDown(e, id)}
              onPointerMove={(e) => onPointerMove(e, id)}
              onPointerUp={() => endDrag(id)}
              onPointerCancel={() => endDrag(id)}
              onPointerLeave={() => setHovered((h) => (h?.id === id ? null : h))}
              onClick={() => onSelect?.(id)}
            >
              {isLeader && (
                <circle
                  data-role="crown"
                  className={styles.crown}
                  r={10}
                  style={{ stroke: node.color, transformOrigin: "center" }}
                />
              )}
              {isMine && (
                <circle
                  data-role="mark"
                  r={10}
                  strokeWidth={2}
                  strokeDasharray="3 5"
                  style={{ fill: "none", stroke: "var(--fg)" }}
                />
              )}
              {/* Colour goes through `style`, not the `fill` attribute: CSS custom
                  properties resolve in CSS declarations but not in presentation
                  attributes, where `fill="var(--c1)"` silently renders black. */}
              <circle
                data-role="body"
                r={1}
                strokeWidth={1}
                fillOpacity={0.92}
                style={{ fill: node.color, stroke: node.color }}
              />
              <text data-role="label" className={styles.label} y={0} style={{ opacity: 0 }}>
                {truncate(node.label)}
              </text>
              <text data-role="count" className={styles.count} y={0} style={{ opacity: 0 }}>
                {node.votes}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredNode && hovered && (
        <div className={styles.tooltip} style={{ left: hovered.x, top: hovered.y }}>
          <span className={styles.tooltipSwatch} style={{ background: hoveredNode.color }} />
          <span>{hoveredNode.label}</span>
          {showCounts && (
            <span className={styles.tooltipCount}>
              {hoveredNode.votes} {hoveredNode.votes === 1 ? "vote" : "votes"}
            </span>
          )}
        </div>
      )}

      {entries.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyRing} />
          <p>Waiting for the first answer</p>
        </div>
      )}
    </div>
  );
}

function truncate(label: string): string {
  return label.length > 18 ? `${label.slice(0, 17)}…` : label;
}

function ariaSummary(entries: TallyEntry[], showCounts: boolean): string {
  if (!entries.length) return "No answers yet.";
  if (!showCounts) return `${entries.length} answers so far. Counts are hidden until the vote closes.`;
  return entries
    .slice(0, 10)
    .map((e) => `${e.label}: ${e.votes}`)
    .join(", ");
}
