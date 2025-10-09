export function handleAnimations(player, anims) {
  // expects:
  // player.size: "small" | "big"
  // player.vx, player.vy: numbers
  // player.grounded: boolean
  // player.facing: 1|-1  (updated here from vx)
  // player.ducking, player.dead (optional)
  // player.animName: string (managed here)

  const abs = Math.abs;
  const moving = abs(player.vx) > 0.05;
  const airborne = !player.grounded;

  // update facing from movement
  if (player.vx > 0.05) player.facing = 1;
  else if (player.vx < -0.05) player.facing = -1;

  const S = player.size === "big" ? "big" : "small";
  let next;

  if (player.dead) {
    next = S + "Jump"; // placeholder
  } else if (player.ducking && player.size === "big" && player.grounded) {
    next = S + "Idle"; // until you add bigDuck
  } else if (airborne) {
    next = S + "Jump";
  } else {
    const turning = moving &&
      ((player.facing === 1 && player.vx < -0.05) ||
       (player.facing === -1 && player.vx >  0.05));
    if (turning) next = S + "Skid";
    else if (moving) next = S + "MarioWalk";
    else next = S + "Idle";
  }

  if (player.animName !== next) {
    if (player.animName && anims[player.animName]) anims[player.animName].reset();
    player.animName = next;
  }

  return { name: player.animName, flipH: (player.facing === -1) };
}
