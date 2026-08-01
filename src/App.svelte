<script lang="ts">
  import Phaser from 'phaser'
  import { Game } from '5velte-ph4ser'
  import Ps2Scene from './web/ps2-scene.ts'

  // The PS2 video mode. Everything the game draws is laid out against it, so
  // it stays the canvas' internal resolution and the scale manager blows it
  // up to the viewport.
  const GAME_W = 640
  const GAME_H = 448

  // How far the viewport's aspect may drift from the frame's 10:7 before
  // ENVELOP stops being the better fill. The margin is deliberately tight:
  // the HUD is drawn flush to the frame edges (WORLD at x=0, COINS against
  // the right edge), so even a few percent of overscan clips it. Within
  // this band the crop is under a pixel, which just soaks up rounding and
  // leaves no letterbox; past it, FIT is the largest picture that still
  // shows the whole frame.
  const MAX_OVERSCAN = 1.02

  // Single-scene game: Ps2Scene hosts the AthenaEnv runtime; all flow
  // (title <-> game, transitions) lives inside the PS2 game code.
  let game: Phaser.Game | undefined = $state()

  /**
   * Whichever of ENVELOP / FIT covers more of the viewport without throwing
   * away too much of the frame — so the canvas claims the maximum screen
   * real estate it can at launch, and again whenever the window changes.
   */
  function pickScaleMode(viewW: number, viewH: number) {
    if (!viewW || !viewH) return Phaser.Scale.FIT
    const gameAspect = GAME_W / GAME_H
    const viewAspect = viewW / viewH
    const mismatch = Math.max(gameAspect / viewAspect, viewAspect / gameAspect)
    return mismatch <= MAX_OVERSCAN ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT
  }

  const initialMode = pickScaleMode(
    typeof window === 'undefined' ? 0 : window.innerWidth,
    typeof window === 'undefined' ? 0 : window.innerHeight
  )

  function applyScaleMode() {
    const scale = game?.scale
    if (!scale) return
    const mode = pickScaleMode(window.innerWidth, window.innerHeight)
    if (scale.scaleMode !== mode) scale.scaleMode = mode
    scale.refresh()
  }

  $effect(() => {
    if (!game) return
    ;(window as unknown as { game: Phaser.Game }).game = game
    // rotating a phone flips which mode wins, so re-decide on every resize
    applyScaleMode()
    window.addEventListener('resize', applyScaleMode)
    window.addEventListener('orientationchange', applyScaleMode)
    return () => {
      window.removeEventListener('resize', applyScaleMode)
      window.removeEventListener('orientationchange', applyScaleMode)
    }
  })
</script>

<Game
  bind:instance={game}
  backgroundColor="#000000"
  scale={{
    mode: initialMode,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
    expandParent: true,
  }}
  render={{ pixelArt: true }}
  scene={[Ps2Scene]}
/>

<style>
  :global(html),
  :global(body) {
    -webkit-touch-callout: none;
    -webkit-text-size-adjust: none;
    -webkit-user-select: none;
    background: #000;
    height: 100%;
    width: 100%;
    margin: 0;
    overflow: hidden;
    touch-action: none;
  }

  :global(canvas) {
    display: block;
  }
</style>
