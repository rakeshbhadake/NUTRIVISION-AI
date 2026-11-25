export default function BowlArt({ className = "" }) {
  return (
    <svg viewBox="0 0 320 260" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bowl" x2="0" y2="1">
          <stop stopColor="#fffdf4" />
          <stop offset="1" stopColor="#e7e6d8" />
        </linearGradient>
        <filter id="bowl-shadow">
          <feDropShadow
            dx="0"
            dy="9"
            stdDeviation="8"
            floodColor="#123425"
            floodOpacity=".16"
          />
        </filter>
      </defs>
      <ellipse
        cx="163"
        cy="225"
        rx="106"
        ry="13"
        fill="#0d2b20"
        opacity=".13"
      />
      <g filter="url(#bowl-shadow)">
        <path
          d="M40 124c4 85 44 113 120 113s116-28 120-113Z"
          fill="url(#bowl)"
        />
        <ellipse cx="160" cy="125" rx="120" ry="68" fill="#fffef5" />
        <ellipse cx="160" cy="122" rx="108" ry="57" fill="#d9e5ad" />
        <g fill="#347248">
          <ellipse
            cx="102"
            cy="101"
            rx="28"
            ry="14"
            transform="rotate(-30 102 101)"
          />
          <ellipse
            cx="80"
            cy="121"
            rx="25"
            ry="13"
            transform="rotate(20 80 121)"
          />
          <ellipse
            cx="115"
            cy="135"
            rx="29"
            ry="15"
            transform="rotate(30 115 135)"
          />
          <ellipse
            cx="138"
            cy="94"
            rx="28"
            ry="15"
            transform="rotate(-40 138 94)"
          />
        </g>
        <g fill="#e88745" stroke="#f6bb75" strokeWidth="4">
          <ellipse
            cx="204"
            cy="112"
            rx="30"
            ry="14"
            transform="rotate(27 204 112)"
          />
          <ellipse
            cx="214"
            cy="135"
            rx="28"
            ry="12"
            transform="rotate(27 214 135)"
          />
          <ellipse
            cx="188"
            cy="94"
            rx="28"
            ry="12"
            transform="rotate(27 188 94)"
          />
        </g>
        <g fill="#e8ca7d">
          <circle cx="153" cy="124" r="11" />
          <circle cx="162" cy="144" r="11" />
          <circle cx="137" cy="150" r="10" />
          <circle cx="176" cy="127" r="10" />
          <circle cx="183" cy="151" r="10" />
        </g>
        <g fill="#bc4535">
          <circle cx="103" cy="157" r="12" />
          <circle cx="119" cy="165" r="11" />
        </g>
        <g fill="#fff2c5">
          <circle cx="152" cy="98" r="3" />
          <circle cx="136" cy="116" r="3" />
          <circle cx="170" cy="108" r="3" />
          <circle cx="190" cy="165" r="3" />
          <circle cx="155" cy="164" r="3" />
        </g>
      </g>
      <g stroke="#d8ce99" strokeWidth="5" strokeLinecap="round">
        <path d="m233 63 58-47m-49 55 58-47" />
      </g>
      <path d="M35 45c26-12 31-8 36 13-19 3-28-1-36-13Z" fill="#aac882" />
      <path d="M265 201c23-10 30-4 28 13-16 3-25-1-28-13Z" fill="#aec888" />
    </svg>
  );
}
