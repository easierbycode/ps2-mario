// vx comes straight off the pad with no inertia, so a reversal only lasts a
// single frame; hold the skid pose this long so it can actually be seen.
const SKID_FRAMES = 8;

export function handleAnimations(player, anims) {
  // expects:
  // player.size: "small" | "big"
  // player.vx, player.vy: numbers
  // player.grounded: boolean
  // player.facing: 1|-1  (updated here from vx)
  // player.ducking, player.dead (optional)
  // player.animName: string (managed here)
  // player.skidTimer: number (managed here)

  const abs = Math.abs;
  const moving = abs(player.vx) > 0.05;
  const airborne = !player.grounded;
  player.skidTimer = player.skidTimer || 0;

  // update facing from movement, keeping the value from last frame so the
  // turning test below can still see the reversal
  const prevFacing = player.facing;
  if (player.vx > 0.05) player.facing = 1;
  else if (player.vx < -0.05) player.facing = -1;

  const S = player.size === "big" ? "big" : "small";
  let next;

  if (player.dead) {
    next = S + "Jump"; // placeholder
  } else if (player.ducking && player.size === "big" && player.grounded) {
    next = anims.bigDuck ? "bigDuck" : S + "Idle"; // only Luigi's sheet has a duck
  } else if (airborne) {
    player.skidTimer = 0;
    next = S + "Jump";
  } else {
    const turning = moving &&
      ((prevFacing === 1 && player.vx < -0.05) ||
       (prevFacing === -1 && player.vx >  0.05));
    if (turning) player.skidTimer = SKID_FRAMES;
    else if (player.skidTimer > 0) player.skidTimer--;

    if (moving && player.skidTimer > 0) next = S + "Skid";
    else if (moving) next = S + "MarioWalk";
    else next = S + "Idle";
  }

  if (player.animName !== next) {
    if (player.animName && anims[player.animName]) anims[player.animName].reset();
    player.animName = next;
  }

  return { name: player.animName, flipH: (player.facing === -1) };
}
