"use client";

import { useId, type CSSProperties } from "react";
import styles from "./BlueOctopus.module.css";

export type BlueMood = "idle" | "listening" | "speaking" | "thinking" | "happy" | "laughing" | "sad" | "crying" | "angry" | "surprised" | "sleepy";

export function moodFromText(text: string): BlueMood {
  if (/\b(cry|crying|tears|pleure|pleurer)\b/i.test(text)) return "crying";
  if (/\b(angry|furious|frustrated|frustré|colère)\b/i.test(text)) return "angry";
  if (/\b(laugh|funny|haha|joke|drôle|rire)\b/i.test(text)) return "laughing";
  if (/\b(tired|sleepy|exhausted|fatigué|épuisé)\b/i.test(text)) return "sleepy";
  if (/\b(sad|lonely|anxious|worried|isolated|triste|seul|stressé)\b/i.test(text)) return "sad";
  if (/\b(wow|surprised|amazing|surpris)\b/i.test(text)) return "surprised";
  if (/\b(happy|good|great|thanks|better|bien|merci|heureux)\b/i.test(text)) return "happy";
  return "idle";
}

/** Shared vector character matching BLUE's cyan octopus expression sheet. */
export default function BlueOctopus({ mood = "idle", level = 0, size }: {
  mood?: BlueMood;
  level?: number;
  /** Fixed width in px; preserves the 320×280 artwork used by the transition clips. */
  size?: number;
}) {
  const id = useId().replace(/:/g, "");
  const paint = (name: string) => `url(#${id}-${name})`;
  const laughing = mood === "laughing";
  const crying = mood === "crying";
  const sad = mood === "sad";
  const sleepy = mood === "sleepy";
  const angry = mood === "angry";
  const roundMouth = sleepy || mood === "surprised";
  const openMouth = roundMouth || laughing || crying || mood === "happy" || mood === "speaking";
  const mouth = roundMouth
    ? "M160 149C179 149 180 185 160 186C140 185 141 149 160 149Z"
    : crying
      ? "M126 158C126 142 143 145 160 149C178 145 194 144 194 159C194 203 126 203 126 158Z"
      : "M126 151C136 145 145 154 160 154C175 154 184 145 194 151C202 205 118 205 126 151Z";
  const leftEye = sad
    ? "M84 111Q117 124 143 106C151 145 131 158 108 148C94 143 87 129 84 111Z"
    : sleepy
      ? "M84 113Q111 128 143 120C139 147 95 151 84 113Z"
      : angry
        ? "M86 101L144 129C140 158 99 153 90 127Z"
        : crying
          ? "M92 91C109 83 141 108 143 129C139 153 100 140 90 121C82 107 81 96 92 91Z"
          : "M94 83C112 76 140 101 143 125C146 150 116 148 99 132C83 117 77 90 94 83Z";
  const rightEye = sad
    ? "M177 106Q203 124 236 111C233 129 226 143 212 148C189 158 169 145 177 106Z"
    : sleepy
      ? "M177 120Q209 128 236 113C225 151 181 147 177 120Z"
      : angry
        ? "M176 129L234 101L230 127C221 153 180 158 176 129Z"
        : crying
          ? "M228 91C239 96 238 107 230 121C220 140 181 153 177 129C179 108 211 83 228 91Z"
          : "M226 83C243 90 237 117 221 132C204 148 174 150 177 125C180 101 208 76 226 83Z";

  return (
    <svg className={styles.character} viewBox="0 0 320 280" role="img"
      aria-label={`BLUE octopus, ${mood}`} focusable="false" data-mood={mood}
      style={{
        "--voice": Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0,
        ...(size !== undefined ? { width: size, height: (size * 280) / 320 } : {}),
      } as CSSProperties}>
      <defs>
        <radialGradient id={`${id}-body`} cx="45%" cy="24%" r="79%">
          <stop stopColor="var(--blue-skin-light)" />
          <stop offset=".6" stopColor="var(--blue-skin)" />
          <stop offset="1" stopColor="var(--blue-skin-shade)" />
        </radialGradient>
        <linearGradient id={`${id}-arm`} x1=".25" y1="0" x2=".65" y2="1">
          <stop stopColor="var(--blue-skin)" /><stop offset="1" stopColor="var(--blue-skin-shade)" />
        </linearGradient>
        <linearGradient id={`${id}-underside`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--blue-sole-light)" /><stop offset="1" stopColor="var(--blue-sole)" />
        </linearGradient>
        <radialGradient id={`${id}-eye`} cx="35%" cy="24%" r="75%">
          <stop stopColor="#616C70" /><stop offset=".32" stopColor="#242C30" />
          <stop offset=".72" stopColor="var(--blue-eye)" /><stop offset="1" stopColor="#02080C" />
        </radialGradient>
        <radialGradient id={`${id}-reflection`}>
          <stop stopColor="white" stopOpacity=".95" /><stop offset=".42" stopColor="white" stopOpacity=".7" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="white" stopOpacity="0" /><stop offset=".42" stopColor="#BAF8FF" stopOpacity=".65" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-mouth`} cx="50%" cy="80%" r="90%">
          <stop stopColor="#07376D" /><stop offset="1" stopColor="var(--blue-mouth)" />
        </radialGradient>
        <radialGradient id={`${id}-tongue`} cx="50%" cy="20%" r="85%">
          <stop stopColor="#C3F1FF" /><stop offset="1" stopColor="#68C9F4" />
        </radialGradient>
        <linearGradient id={`${id}-tear`} x1="0" y1="0" x2="1" y2=".4">
          <stop stopColor="#E7FDFF" /><stop offset=".4" stopColor="#92EEFA" /><stop offset="1" stopColor="#16BDD9" />
        </linearGradient>
        <clipPath id={`${id}-left-eye`}><path d={leftEye} /></clipPath>
        <clipPath id={`${id}-right-eye`}><path d={rightEye} /></clipPath>
        <clipPath id={`${id}-mouth-clip`}><path d={mouth} /></clipPath>
      </defs>
      <ellipse className={styles.shadow} cx="160" cy="269" rx="104" ry="7" fill="#031629" />
      <g className={styles.body}>
        <g className={styles.leftTentacles}>
          <path d="M102 165C66 150 18 166 19 187C19 209 65 203 109 185Z" fill={paint("underside")} />
          <path d="M102 158C65 147 18 162 20 180C25 199 66 192 108 178Z" fill={paint("arm")} />
          <path d="M110 180C75 173 21 199 32 224C45 253 91 222 123 199Z" fill={paint("underside")} />
          <path d="M108 173C76 168 23 192 32 214C44 238 90 212 119 193Z" fill={paint("arm")} />
          <path d="M122 190C98 190 54 213 64 240C77 265 112 244 137 210Z" fill={paint("underside")} />
          <path d="M122 181C97 182 54 207 64 231C77 253 111 235 134 202Z" fill={paint("arm")} />
          <ellipse cx="53" cy="207" rx="20" ry="8" transform="rotate(-31 53 207)" fill={paint("reflection")} opacity=".26" />
        </g>
        <g className={styles.rightTentacles}>
          <path d="M218 165C254 150 302 166 301 187C301 209 255 203 211 185Z" fill={paint("underside")} />
          <path d="M218 158C255 147 302 162 300 180C295 199 254 192 212 178Z" fill={paint("arm")} />
          <path d="M210 180C245 173 299 199 288 224C275 253 229 222 197 199Z" fill={paint("underside")} />
          <path d="M212 173C244 168 297 192 288 214C276 238 230 212 201 193Z" fill={paint("arm")} />
          <path d="M198 190C222 190 266 213 256 240C243 265 208 244 183 210Z" fill={paint("underside")} />
          <path d="M198 181C223 182 266 207 256 231C243 253 209 235 186 202Z" fill={paint("arm")} />
          <ellipse cx="267" cy="207" rx="20" ry="8" transform="rotate(31 267 207)" fill={paint("reflection")} opacity=".22" />
        </g>
        <g className={styles.frontTentacles}>
          <path d="M112 181C96 195 76 236 91 254C108 278 141 270 160 240C178 270 211 278 229 254C244 234 222 194 208 181Z" fill={paint("underside")} />
          <path d="M112 174C96 187 78 226 92 244C110 266 141 257 160 227C179 257 211 266 228 244C242 225 222 186 208 174Z" fill={paint("body")} />
          <ellipse cx="117" cy="239" rx="21" ry="12" fill={paint("reflection")} opacity=".45" />
          <ellipse cx="203" cy="239" rx="21" ry="12" fill={paint("reflection")} opacity=".4" />
        </g>
        <g className={styles.head}>
          <ellipse cx="160" cy="112" rx="112" ry="94" fill={paint("body")} />
          <path className={styles.crownShine} d="M84 58C110 15 187 16 226 49C237 63 225 74 209 66C192 58 183 68 167 61C143 49 129 58 112 57C102 57 91 65 84 58Z" fill={paint("shine")} />
          <g className={styles.eyes}>
            {laughing ? (
              <g fill="none" stroke="var(--blue-eye)" strokeWidth="7" strokeLinecap="round">
                <path d="M84 108C105 89 131 91 141 117" /><path d="M179 117C192 94 218 91 236 111" />
              </g>
            ) : <>
              <path d={leftEye} fill={paint("eye")} />
              <g clipPath={paint("left-eye")}>
                <ellipse cx="105" cy={sad || sleepy ? 130 : 99} rx="17" ry="8" transform={`rotate(32 105 ${sad || sleepy ? 130 : 99})`} fill={paint("reflection")} />
              </g>
              <path d={rightEye} fill={paint("eye")} />
              <g clipPath={paint("right-eye")}>
                <ellipse cx="212" cy={sad || sleepy ? 132 : 100} rx="17" ry="8" transform={`rotate(-32 212 ${sad || sleepy ? 132 : 100})`} fill={paint("reflection")} />
              </g>
            </>}
          </g>
          <g className={styles.brows} stroke="var(--blue-eye)" strokeWidth="6" strokeLinecap="round" fill="none">
            {!laughing && mood !== "happy" && mood !== "speaking" && <>
              <path d={sad || crying ? "M95 79Q116 78 126 60" : angry ? "M85 98L139 126" : sleepy ? "M98 78Q114 66 131 74" : "M102 64Q116 53 130 64"} />
              <path d={sad || crying ? "M194 60Q202 78 225 82" : angry ? "M181 126L235 98" : sleepy ? "M195 76Q211 73 224 85" : "M190 64Q204 53 218 64"} />
            </>}
          </g>
          <path d={sad || angry ? "M154 145Q160 146 166 145" : "M154 139Q160 143 166 139"} fill="none" stroke="var(--blue-eye)" strokeWidth="4.5" strokeLinecap="round" />
          <g className={styles.mouth}>
            {openMouth ? <>
              <path d={mouth} fill={paint("mouth")} />
              <g clipPath={paint("mouth-clip")}>
                <ellipse cx="160" cy={roundMouth ? 185 : 192} rx={roundMouth ? 13 : 28} ry={roundMouth ? 14 : 18} fill={paint("tongue")} />
              </g>
            </> : <path d={sad || angry ? "M144 165Q160 149 176 165" : "M145 154Q160 171 175 154"} stroke="var(--blue-eye)" strokeWidth="4.5" strokeLinecap="round" fill="none" />}
          </g>
          {crying && <g className={styles.tears} fill={paint("tear")}>
            <path d="M93 131C105 128 119 136 112 143C96 143 95 154 96 165C101 186 78 188 79 168C81 157 78 143 85 136Z" />
            <path d="M227 131C215 128 201 136 208 143C224 143 225 154 224 165C219 186 242 188 241 168C239 157 242 143 235 136Z" />
            <path d="M84 188C69 206 77 216 85 214C95 211 91 201 84 188Z" />
            <path d="M236 188C221 206 229 216 237 214C247 211 243 201 236 188Z" />
            <ellipse cx="92" cy="138" rx="8" ry="3" fill="white" opacity=".9" />
            <ellipse cx="228" cy="138" rx="8" ry="3" fill="white" opacity=".9" />
            <ellipse cx="85" cy="166" rx="3" ry="6" fill="white" opacity=".65" />
            <ellipse cx="231" cy="166" rx="3" ry="6" fill="white" opacity=".65" />
          </g>}
          <g className={styles.hand}>
            <path d={sleepy
              ? "M93 218C71 216 73 198 86 180C97 166 114 166 118 178C120 193 108 218 93 218Z"
              : "M221 218C203 215 200 202 211 185C223 173 221 158 231 153C245 146 259 158 255 175C252 196 240 221 221 218Z"}
              fill={paint("body")} />
            <ellipse cx={sleepy ? 98 : 237} cy={sleepy ? 181 : 162} rx="13" ry="7" transform={sleepy ? "rotate(-32 98 181)" : "rotate(-25 237 162)"} fill={paint("reflection")} opacity=".45" />
          </g>
        </g>
      </g>
      {mood === "thinking" && <g className={styles.thought} fill="var(--blue-skin-light)" aria-hidden="true">
        <circle cx="265" cy="65" r="3" /><circle cx="278" cy="51" r="4.5" /><circle cx="288" cy="32" r="7" />
      </g>}
    </svg>
  );
}
