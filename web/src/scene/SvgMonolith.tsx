import type { Outcome, Status } from '../lib/vaultSimulator';
import { deriveStrongboxPose, sceneInput } from '../lib/sceneInput';

export function SvgMonolith({
  status,
  outcome = sceneInput.outcome,
}: {
  status: Status;
  outcome?: Outcome;
}) {
  const derived = deriveStrongboxPose({
    ...sceneInput,
    status,
    outcome,
  });

  const lidLift = Math.round(derived.lidOpen * 42);
  const sealHLocked = derived.sealH === 1;
  const sealRLocked = derived.sealR === 1;
  const envelopeOpened = derived.envelopeOpen >= 0.5;
  const showGleam = derived.gleamIntensity >= 0.35;

  const dialColor =
    status === 'Finalized'
      ? '#1F7A4C'
      : derived.dialAlert
        ? '#D7261E'
        : '#1E4FD8';

  const flapSealColor =
    status === 'Finalized'
      ? '#1F7A4C'
      : status === 'Challenged' || outcome === 'Busted'
        ? '#D7261E'
        : status === 'Pending'
          ? '#E8B412'
          : '#1E4FD8';

  // Orbiting coin angles (static snapshot per status for reduced-motion / SVG fallback)
  const orbitDeg =
    status === 'Idle'
      ? -18
      : status === 'Pending'
        ? 22
        : status === 'Challenged'
          ? -36
          : 12;

  return (
    <svg
      viewBox="-260 -275 520 480"
      aria-hidden="true"
      className={`svg-monolith pose-${status} outcome-${outcome}`}
    >
      {/* Archive shadow base */}
      <ellipse cx="0" cy="154" rx="172" ry="22" fill="#16130D" fillOpacity="0.18" />

      {/* Back half of Inclined Torus Orbit Track */}
      <g transform="translate(0, 18) rotate(-14)">
        <path
          d="M -212 0 A 212 64 0 0 1 212 0"
          fill="none"
          stroke="#16130D"
          strokeWidth="6"
        />
        <path
          d="M -212 0 A 212 64 0 0 1 212 0"
          fill="none"
          stroke="#262019"
          strokeWidth="3"
        />
        <path
          d="M -196 0 A 196 56 0 0 1 196 0"
          fill="none"
          stroke="#D2C5AE"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
      </g>

      {/* Floating Deed Envelope (Amplop Akta) + Gold Gleam (#F5D061) above Strongbox */}
      <g transform={`translate(0, ${-176 - Math.round(lidLift * 0.35)})`}>
        {/* Open Flap (rotated upward behind the emerging deed & gold gleam when Finalized) */}
        {envelopeOpened && (
          <polygon
            points="-68,-38 68,-38 0,-84"
            fill="#EAE1CC"
            stroke="#16130D"
            strokeWidth="2.5"
          />
        )}

        {/* Envelope Base Body (#EAE1CC with #16130D 2px border) */}
        <rect
          x="-68"
          y="-38"
          width="136"
          height="80"
          rx="6"
          fill="#EAE1CC"
          stroke="#16130D"
          strokeWidth="2.5"
        />

        {/* Inner Deed Parchment Card (#FFF8E8) */}
        <g transform={`translate(0, ${envelopeOpened ? -20 : 0})`}>
          <rect
            x="-58"
            y="-32"
            width="116"
            height="66"
            rx="4"
            fill="#FFF8E8"
            stroke="#16130D"
            strokeWidth="2"
          />
          <line x1="-38" y1="-16" x2="38" y2="-16" stroke="#16130D" strokeWidth="2.5" />
          <line x1="-38" y1="-4" x2="26" y2="-4" stroke="#16130D" strokeWidth="2.5" />
        </g>

        {/* Gold Gleam / Inheritance Crest (#F5D061) emerging on Finalized */}
        {showGleam && (
          <g transform="translate(0, -48)">
            <circle
              cx="0"
              cy="0"
              r="30"
              fill="none"
              stroke="#16130D"
              strokeWidth="4.5"
            />
            <circle
              cx="0"
              cy="0"
              r="30"
              fill="none"
              stroke="#F5D061"
              strokeWidth="2.5"
            />
            {/* 4 Radial Gold Gleam Shards */}
            <polygon
              points="0,-42 5,-28 0,-22 -5,-28"
              fill="#F5D061"
              stroke="#16130D"
              strokeWidth="2"
            />
            <polygon
              points="0,42 5,28 0,22 -5,28"
              fill="#F5D061"
              stroke="#16130D"
              strokeWidth="2"
            />
            <polygon
              points="-42,0 -28,5 -22,0 -28,-5"
              fill="#F5D061"
              stroke="#16130D"
              strokeWidth="2"
            />
            <polygon
              points="42,0 28,5 22,0 28,-5"
              fill="#F5D061"
              stroke="#16130D"
              strokeWidth="2"
            />
            {/* Central Gold Octahedron Crest */}
            <polygon
              points="0,-20 18,0 0,20 -18,0"
              fill="#F5D061"
              stroke="#16130D"
              strokeWidth="2.5"
            />
            <line x1="0" y1="-20" x2="0" y2="20" stroke="#16130D" strokeWidth="1.8" />
            <line x1="-18" y1="0" x2="18" y2="0" stroke="#16130D" strokeWidth="1.8" />
          </g>
        )}

        {/* Envelope Front V-Fold Pocket (#FFF8E8 with #16130D 2px border) */}
        <polygon
          points="-68,42 68,42 68,-14 0,14 -68,-14"
          fill="#FFF8E8"
          stroke="#16130D"
          strokeWidth="2.5"
        />

        {/* Closed Top Flap + Wax Seal (when not Finalized) */}
        {!envelopeOpened && (
          <g>
            <polygon
              points="-68,-38 68,-38 0,8"
              fill="#EAE1CC"
              stroke="#16130D"
              strokeWidth="2.5"
            />
            <circle
              cx="0"
              cy="6"
              r="11"
              fill={flapSealColor}
              stroke="#16130D"
              strokeWidth="2.5"
            />
          </g>
        )}
      </g>

      {/* Interior Vault Cavity & Inheritance Deed (Revealed when Finalized) */}
      <g transform={`translate(0, ${-28 - Math.round(lidLift * 0.65)})`}>
        <rect
          x="-116"
          y="-46"
          width="232"
          height="58"
          rx="8"
          fill="#262019"
          stroke="#16130D"
          strokeWidth="3.5"
        />
        {derived.lidOpen > 0.05 && (
          <g>
            <rect
              x="-74"
              y="-68"
              width="148"
              height="52"
              rx="5"
              fill="#F2EBDD"
              stroke="#16130D"
              strokeWidth="3.5"
            />
            <polygon
              points="0,-78 16,-56 0,-34 -16,-56"
              fill="#E8B412"
              stroke="#16130D"
              strokeWidth="3"
            />
          </g>
        )}
      </g>

      {/* Hinged Lid + Engraved Deadline Ring */}
      <g transform={`translate(0, ${-72 - lidLift})`}>
        {/* Lid Main Block */}
        <rect
          x="-144"
          y="-34"
          width="288"
          height="46"
          rx="12"
          fill="#E6DECB"
          stroke="#16130D"
          strokeWidth="4"
        />
        {/* Hard shade band on lid */}
        <path
          d="M -140 -2 H 140 V 10 H -140 Z"
          fill="#D2C5AE"
        />
        {/* Owner Handle on top */}
        <rect
          x="-46"
          y="-48"
          width="92"
          height="14"
          rx="4"
          fill="#1E4FD8"
          stroke="#16130D"
          strokeWidth="3.5"
        />
        {/* Deadline Ring Track */}
        <rect
          x="-120"
          y="-18"
          width="240"
          height="10"
          rx="5"
          fill="#262019"
          stroke="#16130D"
          strokeWidth="2.5"
        />
        {/* Primary Deadline Fill (Heir Mustard) */}
        <rect
          x="-118"
          y="-16"
          width={Math.round(156 * derived.ringFill)}
          height="6"
          rx="3"
          fill="#E8B412"
        />
        {/* Challenge Extension Segment (Rival Red) */}
        {derived.ringExtended && (
          <rect
            x="42"
            y="-16"
            width="76"
            height="6"
            rx="3"
            fill="#D7261E"
          />
        )}
        {/* Lid Clasp */}
        <rect
          x="-28"
          y="4"
          width="56"
          height="18"
          rx="4"
          fill="#262019"
          stroke="#16130D"
          strokeWidth="3"
        />
      </g>

      {/* Main Strongbox Body */}
      <g>
        <rect
          x="-140"
          y="-60"
          width="280"
          height="182"
          rx="16"
          fill="#E6DECB"
          stroke="#16130D"
          strokeWidth="4"
        />
        {/* Single Hard Shade Band at lower strongbox */}
        <path
          d="M -136 68 H 136 V 118 H -136 Z"
          fill="#D2C5AE"
        />
        {/* Recessed Front Ledger Plate */}
        <rect
          x="-116"
          y="-38"
          width="232"
          height="136"
          rx="10"
          fill="#D2C5AE"
          stroke="#16130D"
          strokeWidth="3.5"
        />
        {/* Archive Feet */}
        <rect x="-112" y="122" width="36" height="16" rx="3" fill="#262019" stroke="#16130D" strokeWidth="3" />
        <rect x="76" y="122" width="36" height="16" rx="3" fill="#262019" stroke="#16130D" strokeWidth="3" />
      </g>

      {/* Left Side: Owner Heartbeat Dial */}
      <g transform="translate(-148, 22)">
        <circle
          cx="0"
          cy="0"
          r="34"
          fill={dialColor}
          stroke="#16130D"
          strokeWidth="4"
        />
        <circle
          cx="0"
          cy="0"
          r="24"
          fill="#F2EBDD"
          stroke="#16130D"
          strokeWidth="3"
        />
        <line
          x1="0"
          y1="0"
          x2={derived.dialAlert ? '14' : '0'}
          y2={derived.dialAlert ? '-12' : '-18'}
          stroke={dialColor}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="0" cy="0" r="4.5" fill="#16130D" />
      </g>

      {/* Rival Challenge Clamp Bar (connects Seal R to Seal H when Challenged / Busted) */}
      {derived.clampLocked && (
        <rect
          x="-56"
          y="18"
          width="112"
          height="20"
          rx="5"
          fill="#D7261E"
          stroke="#16130D"
          strokeWidth="3.5"
        />
      )}

      {/* Front Left: Seal H (Heir Mustard) */}
      <g
        transform={`translate(-56, 28) rotate(${sealHLocked ? 90 : 0}) scale(${sealHLocked ? 0.94 : 1})`}
      >
        <circle
          cx="0"
          cy="0"
          r="38"
          fill="#E8B412"
          stroke="#16130D"
          strokeWidth="4"
        />
        <circle
          cx="0"
          cy="0"
          r="28"
          fill="none"
          stroke="#262019"
          strokeWidth="3"
        />
        {/* Mechanical H keyway bars */}
        <rect x="-13" y="-14" width="6" height="28" fill="#16130D" />
        <rect x="7" y="-14" width="6" height="28" fill="#16130D" />
        <rect x="-10" y="-3" width="20" height="6" fill="#16130D" />
      </g>

      {/* Front Right: Seal R (Rival Red) */}
      <g
        transform={`translate(56, 28) rotate(${sealRLocked ? -90 : 0}) scale(${sealRLocked ? 0.94 : 1})`}
      >
        <circle
          cx="0"
          cy="0"
          r="38"
          fill="#D7261E"
          stroke="#16130D"
          strokeWidth="4"
        />
        <circle
          cx="0"
          cy="0"
          r="28"
          fill="none"
          stroke="#262019"
          strokeWidth="3"
        />
        {/* Mechanical R keyway bars */}
        <rect x="-12" y="-14" width="6" height="28" fill="#16130D" />
        <rect x="-8" y="-14" width="18" height="12" rx="3" fill="#16130D" />
        <line x1="-2" y1="-2" x2="11" y2="14" stroke="#16130D" strokeWidth="6" />
      </g>

      {/* Front half of Inclined Torus Orbit Track + Orbiting Seal Coins (Koin H & Koin R) */}
      <g transform="translate(0, 18) rotate(-14)">
        <path
          d="M -212 0 A 212 64 0 0 0 212 0"
          fill="none"
          stroke="#16130D"
          strokeWidth="6.5"
        />
        <path
          d="M -212 0 A 212 64 0 0 0 212 0"
          fill="none"
          stroke="#262019"
          strokeWidth="3.5"
        />

        {/* Orbiting Koin H (Heir Mustard #E8B412) */}
        <g
          transform={`translate(${Math.round(Math.cos((orbitDeg * Math.PI) / 180) * 212)}, ${Math.round(Math.sin((orbitDeg * Math.PI) / 180) * 64)}) rotate(14) scale(${derived.coinHActive ? 1.12 : 1})`}
        >
          <circle
            cx="0"
            cy="0"
            r="26"
            fill="#E8B412"
            stroke="#16130D"
            strokeWidth="3.5"
          />
          <circle
            cx="0"
            cy="0"
            r="19"
            fill="none"
            stroke="#262019"
            strokeWidth="2.5"
          />
          <rect x="-9" y="-10" width="4.5" height="20" fill="#16130D" />
          <rect x="4.5" y="-10" width="4.5" height="20" fill="#16130D" />
          <rect x="-7" y="-2.2" width="14" height="4.5" fill="#16130D" />
        </g>

        {/* Orbiting Koin R (Rival Stamp Red #D7261E) */}
        <g
          transform={`translate(${Math.round(Math.cos(((orbitDeg + 180) * Math.PI) / 180) * 212)}, ${Math.round(Math.sin(((orbitDeg + 180) * Math.PI) / 180) * 64)}) rotate(14) scale(${derived.coinRActive ? 1.14 : 1})`}
        >
          <circle
            cx="0"
            cy="0"
            r="26"
            fill="#D7261E"
            stroke="#16130D"
            strokeWidth="3.5"
          />
          <circle
            cx="0"
            cy="0"
            r="19"
            fill="none"
            stroke="#262019"
            strokeWidth="2.5"
          />
          <rect x="-8.5" y="-10" width="4.5" height="20" fill="#16130D" />
          <rect x="-6" y="-10" width="13" height="8.5" rx="2" fill="#16130D" />
          <line x1="-1" y1="-1.5" x2="7.5" y2="10" stroke="#16130D" strokeWidth="4.5" />
        </g>
      </g>
    </svg>
  );
}
