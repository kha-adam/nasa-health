import { useId } from "react";

const BODY_PATH =
  "M 90 72 C 90 82, 88 86, 80 89 C 66 93, 54 96, 49 108 C 44 122, 42 150, 38 178 C 35 200, 30 225, 28 248 " +
  "C 27 258, 30 266, 36 264 C 41 262, 41 252, 42 244 C 45 222, 50 200, 54 180 C 57 165, 60 150, 62 138 " +
  "C 64 160, 66 190, 68 214 C 69 232, 64 246, 64 262 C 64 300, 70 345, 74 380 C 76 398, 74 412, 72 422 " +
  "C 70 430, 88 432, 90 424 C 90 400, 92 360, 94 330 C 96 305, 98 290, 100 282 C 102 290, 104 305, 106 330 " +
  "C 108 360, 110 400, 110 424 C 112 432, 130 430, 128 422 C 126 412, 124 398, 126 380 C 130 345, 136 300, 136 262 " +
  "C 136 246, 131 232, 132 214 C 134 190, 136 160, 138 138 C 140 150, 143 165, 146 180 C 150 200, 155 222, 158 244 " +
  "C 159 252, 159 262, 164 264 C 170 266, 173 258, 172 248 C 170 225, 165 200, 162 178 C 158 150, 156 122, 151 108 " +
  "C 146 96, 134 93, 120 89 C 112 86, 110 82, 110 72 Z";

const FRONT_CONTOURS =
  "M 66 115 Q 82 97 98 105 M 102 105 Q 118 97 134 115 M 100 104 L 100 161 " +
  "M 69 155 Q 85 166 98 157 M 102 157 Q 115 166 131 155 M 76 186 Q 100 199 124 186 " +
  "M 74 240 Q 100 261 126 240 M 77 350 Q 83 356 92 350 M 108 350 Q 117 356 123 350";

const BACK_CONTOURS =
  "M 100 85 C 98 127 102 167 100 230 M 64 108 Q 88 105 92 133 Q 84 157 74 159 " +
  "M 136 108 Q 112 105 108 133 Q 116 157 126 159 M 72 246 Q 83 260 96 251 M 104 251 Q 117 260 128 246";

export default function BodyIllustration({ cosine, sine }: { cosine: number; sine: number }) {
  const id = useId();
  const width = Math.hypot(cosine, sine * 0.43);
  const back = cosine < 0;
  const light = 0.45 - 0.14 * sine;
  const profile = Math.abs(sine) * (1 - Math.abs(cosine));
  const shade = "url(#" + id + "-shade)";
  const head = "url(#" + id + "-head)";
  const highlight = "url(#" + id + "-relief)";

  return (
    <g aria-hidden pointerEvents="none">
      <defs>
        <linearGradient id={id + "-shade"} x2="1" y2=".12">
          <stop stopColor="#7196b8" />
          <stop offset=".17" stopColor="#b0c9df" />
          <stop offset={light} stopColor="#f3f9ff" />
          <stop offset=".73" stopColor="#b4cce2" />
          <stop offset="1" stopColor="#7599ba" />
        </linearGradient>
        <radialGradient id={id + "-head"} cx={light} cy=".33" r=".69">
          <stop stopColor="#f4f9ff" />
          <stop offset=".53" stopColor="#c7dbed" />
          <stop offset=".81" stopColor="#94b4d0" />
          <stop offset="1" stopColor="#6c92b3" />
        </radialGradient>
        <radialGradient id={id + "-relief"} cx=".38" cy=".35" r=".65">
          <stop stopColor="#f7fbff" stopOpacity=".85" />
          <stop offset="1" stopColor="#f7fbff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + "-floor"}>
          <stop stopColor="#507ca4" stopOpacity=".3" />
          <stop offset="1" stopColor="#507ca4" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id + "-outline"}><path d={BODY_PATH} /></clipPath>
      </defs>

      <ellipse cx="100" cy="436" rx={30 + 37 * width} ry="7" fill={"url(#" + id + "-floor)"} />
      <g transform={"translate(100 0) scale(" + width + " 1) translate(-100 0)"}>
        <path d={BODY_PATH} fill={shade} stroke="#829fb9" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
        <g clipPath={"url(#" + id + "-outline)"}>
          {[-1, 1].map((side) => (
            <g key={side} transform={"translate(100 0) scale(" + side + " 1) translate(-100 0)"}>
              <ellipse cx="81" cy={back ? "121" : "133"} rx="28" ry="47" fill={highlight} />
              <ellipse cx="49" cy="155" rx="10" ry="61" fill={highlight} transform="rotate(12 49 155)" />
              <ellipse cx="79" cy="291" rx="15" ry="67" fill={highlight} transform="rotate(-6 79 291)" />
              <ellipse cx="83" cy="376" rx="9" ry="38" fill={highlight} />
            </g>
          ))}
          <ellipse cx="100" cy="204" rx="32" ry="62" fill={highlight} opacity=".55" />
          <path d={back ? BACK_CONTOURS : FRONT_CONTOURS} fill="none" stroke="#648caf" strokeWidth="1" opacity={0.21 + 0.35 * Math.abs(cosine)} vectorEffect="non-scaling-stroke" />
        </g>
        <ellipse cx="100" cy="43" rx="25" ry="31" fill={head} stroke="#829fb9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>
      {profile > 0.1 && (
        <path
          d="M 107 18 Q 116 24 117 36 L 122 46 Q 123 48 117 49 L 118 56 Q 116 64 108 68"
          transform={sine < 0 ? "translate(200 0) scale(-1 1)" : undefined}
          fill={head}
          stroke="#829fb9"
          strokeWidth=".8"
          opacity={profile}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}
