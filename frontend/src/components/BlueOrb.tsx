"use client";

import type { CSSProperties } from "react";
import styles from "./BlueOrb.module.css";

export type BlueState = "idle" | "listening" | "thinking" | "speaking";

export default function BlueOrb({ state = "idle", level = 0, small = false }: {
  state?: BlueState; level?: number; small?: boolean;
}) {
  return <span className={`${styles.orb} ${small ? styles.small : ""}`} data-state={state}
    style={{ "--audio-level": Math.max(0, Math.min(1, level)) } as CSSProperties}
    role="img" aria-label={`BLUE, ${state}`}>
    <span className={styles.ring} aria-hidden="true"/>
    <span className={styles.circle} aria-hidden="true"/>
  </span>;
}
