"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/blue";
import styles from "./VoicePsychologistFab.module.css";

function wrap(text: string, width: number, measure: (text: string) => number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (line && measure(next) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export default function VoiceSubtitle({ turn }: { turn?: ChatMessage }) {
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const text = turn?.content ?? "";

  useLayoutEffect(() => {
    const element = box.current;
    const canvas = document.createElement("canvas").getContext("2d");
    if (!element || !canvas) return;
    const layout = () => {
      const style = getComputedStyle(element);
      canvas.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
      const width = Math.max(1, element.clientWidth - 12);
      setLines(wrap(text, width, (line) => canvas.measureText(line).width));
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  const pageCount = Math.ceil(lines.length / 2);
  const current = Math.min(page, Math.max(0, pageCount - 1));
  const visible = lines.slice(current * 2, current * 2 + 2);
  const words = visible.join(" ").split(/\s+/).length;
  useEffect(() => {
    if (current + 1 >= pageCount) return;
    const next = window.setTimeout(() => setPage(current + 1), Math.max(2200, 360 * words));
    return () => window.clearTimeout(next);
  }, [current, pageCount, words]);

  return (
    <div ref={box} className={styles.subtitle} aria-label="Current subtitle">
      {text && <span className="sr-only" role="status">{turn?.role === "user" ? "You: " : "Bleu: "}{text}</span>}
      {visible.length > 0 && (
        <p key={current} className={styles.subtitlePage} aria-hidden="true">
          {visible.join("\n")}
        </p>
      )}
    </div>
  );
}
