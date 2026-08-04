// Shared pre-game session config, set on the title screen and read when the
// game screen builds its players.
//
// The Konami code swaps the default duo (Mario / Luigi) for the space duo
// (Space Mario / Nabbit) — entering it again swaps back. "character" names
// the set: "mario" is the default, "space" the alternate.
let current = "mario";

// 1 or 2 simultaneous players. Player 2 is Luigi (Nabbit in space mode).
let playerCount = 1;

// Which pad port each player reads. Both default to port 0 — two players
// sharing one controller works out of the box; the title screen's ASSIGN
// PADS menu points them at separate ports.
const padPorts = [0, 0];

// Until ASSIGN PADS has been used the ports are a default, not a choice, so
// a solo player answers to any pad rather than only to port 1.
let padsAssigned = false;

export function setCharacter(name) {
  current = name;
}

export function getCharacter() {
  return current;
}

export function setPlayerCount(n) {
  playerCount = n === 2 ? 2 : 1;
}

export function getPlayerCount() {
  return playerCount;
}

export function setPadPort(playerIndex, port) {
  padPorts[playerIndex] = port;
  padsAssigned = true;
}

export function getPadPort(playerIndex) {
  return padPorts[playerIndex] ?? 0;
}

export function padsAreAssigned() {
  return padsAssigned;
}
