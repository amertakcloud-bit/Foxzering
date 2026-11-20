export default function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={50}>
      <defs>
        <linearGradient id="darkGhost" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--text)" />
          <stop offset="100%" stopColor="var(--text-muted)" />
        </linearGradient>
      </defs>
      <path
        d="M164 131 C195 64 260 29 326 43 C407 59 452 130 450 216 C448 305 385 378 300 385 C277 388 263 378 249 360 C238 370 218 365 211 350 C201 367 181 371 166 358 C148 343 154 325 169 309 C142 309 126 290 133 270 C138 255 150 247 164 239 C128 237 113 211 131 188 C142 175 154 164 164 131Z"
        fill="#777"
        opacity=".5"
        transform="translate(0 10)"
      />
      <path
        d="M164 131 C195 64 260 29 326 43 C407 59 452 130 450 216 C448 305 385 378 300 385 C277 388 263 378 249 360 C238 370 218 365 211 350 C201 367 181 371 166 358 C148 343 154 325 169 309 C142 309 126 290 133 270 C138 255 150 247 164 239 C128 237 113 211 131 188 C142 175 154 164 164 131Z"
        fill="url(#darkGhost)"
      />
      <ellipse cx="317" cy="201" rx="21" ry="31" fill="var(--bg)" />
      <ellipse cx="390" cy="201" rx="21" ry="31" fill="var(--bg)" />
      <circle cx="119" cy="244" r="9" fill="#444" />
      <circle cx="154" cy="258" r="8" fill="#444" />
      <circle cx="211" cy="395" r="13" fill="#555" />
    </svg>
  );
}
