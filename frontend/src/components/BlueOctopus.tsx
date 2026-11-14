"use client";

import { useId, type CSSProperties } from "react";
import styles from "./BlueOctopus.module.css";

export type BlueMood = "idle" | "listening" | "speaking" | "thinking" | "happy" | "laughing" | "sad" | "crying" | "angry" | "surprised" | "sleepy";

export function moodFromText(text: string): BlueMood {
  if (/\b(laugh|funny|haha|joke|drôle|rire)\b/i.test(text)) return "laughing";
  if (/\b(tired|sleepy|exhausted|fatigué|épuisé)\b/i.test(text)) return "sleepy";
  if (/\b(sad|lonely|anxious|worried|isolated|triste|seul|stressé)\b/i.test(text)) return "sad";
  if (/\b(wow|surprised|amazing|surpris)\b/i.test(text)) return "surprised";
  if (/\b(happy|good|great|thanks|better|bien|merci|heureux)\b/i.test(text)) return "happy";
  return "idle";
}

/** Articulated vector character inspired by the user's blue octopus reference. */
export default function BlueOctopus({ mood = "idle", level = 0 }: { mood?: BlueMood; level?: number }) {
  const id = useId().replace(/:/g, "");
  const happy = mood === "happy" || mood === "laughing";
  const worried = mood === "sad" || mood === "crying";
  const sleepy = mood === "sleepy";
  const angry = mood === "angry";
  const talking = mood === "speaking";
  return <svg className={styles.character} viewBox="0 0 320 280" role="img" aria-label={`BLUE octopus, ${mood}`} data-mood={mood} style={{ "--voice": level } as CSSProperties}>
    <defs>
      <radialGradient id={`${id}body`} cx="40%" cy="25%" r="85%"><stop stopColor="#20D4F2"/><stop offset=".65" stopColor="#00B5E3"/><stop offset="1" stopColor="#0284C7"/></radialGradient>
      <linearGradient id={`${id}arm`} x2=".8" y2="1"><stop stopColor="#00B5E3"/><stop offset="1" stopColor="#0284C7"/></linearGradient>
      <radialGradient id={`${id}eyes`} cx="32%" cy="23%"><stop stopColor="white"/><stop offset=".12" stopColor="#929DA2"/><stop offset=".35" stopColor="#263238"/><stop offset="1" stopColor="#111B22"/></radialGradient>
      <linearGradient id={`${id}shine`} x2="0" y2="1"><stop stopColor="white" stopOpacity=".65"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
    </defs>
    <ellipse cx="160" cy="259" rx="99" ry="10" fill="#BAE6FD" opacity=".55"/>
    <g className={styles.body}>
      <g className={styles.leftTentacles}>
        <path d="M104 183C64 162 25 187 29 207C35 231 77 216 109 199Z" fill="#C90068"/>
        <path d="M105 176C65 156 25 180 29 198C36 218 78 208 110 191Z" fill={`url(#${id}arm)`}/>
        <path d="M119 208C86 195 35 215 47 238C61 262 105 235 128 223Z" fill="#C90068"/>
        <path d="M118 199C85 187 35 206 47 229C62 249 105 227 128 215Z" fill={`url(#${id}arm)`}/>
      </g>
      <g className={styles.rightTentacles}>
        <path d="M216 183C256 162 295 187 291 207C285 231 243 216 211 199Z" fill="#C90068"/>
        <path d="M215 176C255 156 295 180 291 198C284 218 242 208 210 191Z" fill={`url(#${id}arm)`}/>
        <path d="M201 208C234 195 285 215 273 238C259 262 215 235 192 223Z" fill="#C90068"/>
        <path d="M202 199C235 187 285 206 273 229C258 249 215 227 192 215Z" fill={`url(#${id}arm)`}/>
      </g>
      <g className={styles.frontTentacles}>
        <path d="M105 205C86 219 84 254 111 260C137 268 151 246 160 235C172 258 195 268 212 255C232 239 219 215 207 203Z" fill="#C90068"/>
        <path d="M108 191C86 208 84 242 111 250C137 258 151 235 160 224C173 249 195 258 212 245C232 228 217 204 205 192Z" fill={`url(#${id}body)`}/>
        <ellipse cx="115" cy="236" rx="14" ry="7" fill={`url(#${id}shine)`}/><ellipse cx="200" cy="234" rx="12" ry="7" fill={`url(#${id}shine)`}/>
      </g>
      <g className={styles.head}>
        <ellipse cx="160" cy="127" rx="111" ry="103" fill={`url(#${id}body)`}/>
        <path d="M93 61C123 32 182 29 215 58C218 70 204 73 188 66C168 57 151 72 130 61C117 55 102 65 93 61Z" fill={`url(#${id}shine)`}/>
        <g className={styles.eyes}>
          {happy ? <g fill="none" stroke="#10232C" strokeWidth="8" strokeLinecap="round"><path d="M91 127Q116 101 139 130"/><path d="M181 130Q206 103 231 128"/></g> : <>
            <path d={sleepy ? "M88 132Q112 147 143 141Q136 171 111 166Q93 161 88 132Z" : angry ? "M88 117L144 143Q135 171 110 159Q93 150 88 117Z" : worried ? "M91 127Q112 144 140 132Q143 169 114 162Q94 158 91 127Z" : "M94 103C111 94 143 122 140 147C136 173 96 153 89 130C85 116 87 107 94 103Z"} fill={`url(#${id}eyes)`}/>
            <path d={sleepy ? "M178 141Q206 148 234 134Q224 166 202 167Q180 166 178 141Z" : angry ? "M177 143L234 117Q228 153 207 161Q184 169 177 143Z" : worried ? "M180 132Q208 144 231 127Q229 160 207 163Q178 169 180 132Z" : "M228 103C211 94 179 122 182 147C186 173 226 153 233 130C237 116 235 107 228 103Z"} fill={`url(#${id}eyes)`}/>
          </>}
        </g>
        <g className={styles.brows} stroke="#10232C" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d={worried ? "M96 96Q118 96 126 78" : angry ? "M94 100L134 121" : "M101 87Q116 76 129 88"}/>
          <path d={worried ? "M193 78Q202 96 225 96" : angry ? "M187 121L227 100" : "M191 88Q205 78 219 89"}/>
        </g>
        <path d="M153 155Q160 160 167 155" fill="none" stroke="#10232C" strokeWidth="4" strokeLinecap="round"/>
        <g className={styles.mouth}>
          {talking || happy || mood === "surprised" || mood === "crying" || sleepy ? <>
            <path d={mood === "surprised" || sleepy ? "M160 169C180 168 181 204 160 205C139 204 140 169 160 169Z" : "M130 168Q160 180 190 168C203 208 126 215 130 168Z"} fill="#8D1031"/>
            <ellipse cx="160" cy="194" rx={sleepy || mood === "surprised" ? 10 : 21} ry="10" fill="#FA719B"/>
          </> : <path d={worried || angry ? "M145 184Q160 165 175 184" : "M145 174Q160 190 175 174"} stroke="#10232C" strokeWidth="5" strokeLinecap="round" fill="none"/>}
        </g>
        {mood === "crying" && <g fill="#BAE6FD"><path d="M105 161Q80 184 94 201Q111 204 110 187Z"/><path d="M215 161Q240 184 226 201Q209 204 210 187Z"/></g>}
        <g className={styles.hand}><path d="M222 192C223 177 230 153 241 157L244 143Q248 134 253 145L256 136Q261 135 262 145L266 141Q273 143 269 157C282 171 263 202 245 210Z" fill={`url(#${id}body)`}/></g>
      </g>
    </g>
    {mood === "thinking" && <g className={styles.thought} fill="#0284C7"><circle cx="264" cy="74" r="3"/><circle cx="277" cy="61" r="5"/><circle cx="287" cy="42" r="9" fill="#BAE6FD"/></g>}
  </svg>;
}
