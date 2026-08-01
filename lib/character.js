// Shared player-character selection. Defaults to Mario; the Konami code
// on the title screen swaps in DK.
let current = "mario";

export function setCharacter(name) {
  current = name;
}

export function getCharacter() {
  return current;
}
