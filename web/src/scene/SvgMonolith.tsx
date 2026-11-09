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
  const dialColor =
    status === 'Finalized'
      ? '#1F7A4C'
      : derived.dialAlert
        ? '#D7261E'
        : '#1E4FD8';

  return (
    <svg
      viewBox="-240 -210 480 420"
      aria-hidden="true"
      className={`svg-monolith pose-${status} outcome-${outcome}`}
    >
      {/* Archive shadow base */}
      <ellipse cx="0" cy="146" rx="164" ry="22" fill="#16130D" fillOpacity="0.18" />

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
    </svg>
  );
}
