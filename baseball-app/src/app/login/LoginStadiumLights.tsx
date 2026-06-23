import type { CSSProperties } from "react";

/** Decorative outfield light towers — animation in globals.css (`.login-night-*`). */
const TOWER_HEIGHTS = [58, 72, 84, 92, 100, 92, 84, 72, 58] as const;

export function LoginStadiumLights() {
  return (
    <div className="login-night-lights" aria-hidden>
      <div className="login-night-horizon-glow" />
      <div className="login-night-field-mist" />
      <div className="login-night-towers">
        {TOWER_HEIGHTS.map((height, i) => (
          <div
            key={i}
            className="login-night-tower"
            style={
              {
                "--light-index": i,
                "--tower-height": `${height}%`,
              } as CSSProperties
            }
          >
            <div className="login-night-lamp-wrap">
              <div className="login-night-lamp" />
              <div className="login-night-beam" />
            </div>
            <div className="login-night-pole" />
          </div>
        ))}
      </div>
    </div>
  );
}
