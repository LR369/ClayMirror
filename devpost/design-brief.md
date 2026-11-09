---
status: approved
---

# Design brief: Clay Mirror (working title, default)

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
First you place your workbench, with the wheel and tools on it, where you want it in your space: grab and drag the bench, use a slider to set it at the best height for you, then pinch Start. Once you agree it's where you want it, the wheel starts turning. You drop a block of clay on a potter's wheel on the table in front of you. It spins in real time, and every time you touch it the block deforms, so it responds and almost feels like real clay, like the "Ghost" moment in the movie. You shape it to match the vase sitting just behind the wheel, then pinch Done to get your score and watch your potter skill improve and bonuses come in.

## Why it belongs on glasses
- Uses: draws in the world, leaves your body free
- Why it's better than the phone or laptop version: the wheel, clay and target vase are real-sized objects on a workbench in your space, not a flat picture. You reach out and pull the clay with your hand instead of swiping glass, and you can lean in or walk around the wheel to check your vase from the side like a real potter. A phone only ever shows it from the front.

## Product or overlay
- Type: product. The virtual workbench, wheel, clay and game are the experience.
- What the real version would sense: nothing beyond standard hand pinches. No real objects are recognized.
- Stand-in for the preview: the workbench is a virtual table at real size, since the preview can't see a real table. The player places it by hand (drag + height slider) instead of it snapping to a real table or floor. No other stand-in is needed.

## Where things live
Laid out like a real potter's workbench, everything on or around one table.
- Where the user is looking during the main task: down at their hand and the spinning clay on the wheel, with a quick glance up at the target vase and the live %.
- Virtual workbench table: first appears in front of the user at table height, top about 75 cm off the floor (default), front edge about 40 cm from the user (default), about 100 x 60 cm (default). The player can move it and raise or lower it during placement (see below). Everything on and around the bench (wheel, clay, target vase and its stand, live %, buttons) moves with it as one set (default).
- Placement controls, on the bench while you drag it: they sit on the front edge of the bench and travel with it.
  - Height slider: on the front edge, left side (default), about 20 cm long (default). Sets the bench top height from about 55 cm (seated) to about 110 cm (tall standing) (default).
  - Start button: on the front edge, right side (default), big, about 8 cm across (default).
- Settings (gear) button: on the bench, back-right corner, away from Done so it isn't pressed by mistake (default), about 6 cm across (default). Shows during play.
- Potter's wheel: on the table, closest to the user, centered, about 55 to 60 cm from the user's eyes (default). Wheel head about 30 cm across (default). Spins continuously.
- Clay block: starts resting on the bench beside the wheel (default), about 12 cm across and 15 cm tall (default), clay-brown and lit so it reads well (not dark). Once dropped on the wheel it snaps to the center and spins with it.
- Ghost outline: the target vase's profile drawn as a light, see-through outline around the clay on the wheel, at the same scale, so you can see where to push and pull.
- Target vase (what you need to replicate): just behind the wheel and a little to the right, like a model on a shelf, about 90 cm from the user and 25 cm to the right (default), on a small stand so it sits at about eye level minus 20 cm (default). Shown at real size, about 25 cm tall (default).
- Live match %: floating just above the target vase, large light text, readable from where the user stands.
- Undo button: on the bench next to the wheel (left side, default), big, about 8 cm across (default).
- Done button: on the bench next to the wheel, beside Undo (default), big, about 8 cm across (default).
- Start Over button: on the bench next to Undo and Done, always available, big, about 8 cm across (default). Keep it a little apart from Done so it isn't pressed by mistake (default).
- Glowing pinch ring: a thin glowing ring around the clay at the height your hand is aimed at or pinching, so you can see exactly which part of the clay you've grabbed.
- Sound: comes from the wheel itself (spatial sound).
- Comfort: everything stays low and close on the bench so arms stay down, nothing needs reaching up or behind. The adjustable height lets seated and standing players set the bench where their arms can stay low. Rounds are short, to suit short bursts of play.
- Results (score, potter skill bar, bonuses): appear above the target vase, in the same spot the live % was, after Done.
- First-time hints (FTUE): white text (for now; may change to best fit the environment) surrounded by a light green neon border/glow, gently bobbing up and down, floating just above the thing it's about (about 10 cm above, default), never blocking the clay, buttons, target or live %.

## Hands and input
- Place the bench: grab the bench (by its tabletop or edge, not by the clay or wheel, default) and drag it where you want it. It stays level and slides around you; it doesn't tilt (default). Drag the height slider to raise or lower it. Pinch Start when you're happy with it, and the wheel starts turning.
- Change placement later: pinch the gear button any time during play. The wheel pauses and the clay keeps its shape, and the height slider and Start button come back on the bench's front edge. Move or adjust the bench, then pinch Start to carry on where you left off; the wheel starts turning again.
- Drop the clay: grab the clay block with a pinch and release it over the wheel. It snaps to the center of the wheel (default) and starts spinning.
- Sculpt: pinch a spot on the spinning clay with one hand and drag. Inward narrows it, outward widens it, up pulls it taller, down squashes it shorter. Because the wheel spins, each change goes all the way around the clay at the height you pinched, like a real wheel. The clay changes continuously while you drag, not only when you let go.
- Limits and collapse: if you drag inward too far (clay too thin) or pull it too tall, the whole piece collapses into a blob at the bottom of the wheel with the piece you were touching sitting on top. Undo brings back the piece from before the collapse (default).
- Undo: pinch the Undo button to reverse the last drag.
- Start Over: pinch the Start Over button any time to get a fresh block of clay for the same target.
- Feedback (there's no vibration on glasses, so sound and light do the work): a soft wheel hum while it spins, a wet clay squish while you drag, a sloppy splat when it collapses (default), and a satisfying chime on Done. The glowing ring brightens while you pinch (default).
- Done: pinch the Done button to lock in the piece and get the score.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Placement mode (at the start, and whenever the gear is pinched): the height slider and Start button show on the bench's front edge. The wheel is still. Undo, Done, Start Over, the gear and the live % are hidden (default). The bench gets a soft light outline so it's clear it can be moved (default). Pinching Start hides the slider and Start and begins (or resumes) play.
- Gear button: shows during play, hidden during placement mode and on the results screen (default).
- Ghost outline: shows all the time once the clay is on the wheel, hides on the results screen (default).
- Live match %: shows above the target while sculpting and updates as the clay changes. It's replaced by the results after Done.
- Undo and Done buttons: show while sculpting.
- Results (score, potter skill bar filling up, bonuses earned): show after Done, above the target vase. A "Next vase" button (default) starts a new round with a fresh block.
- First-time hints, one at a time, white text in a light green neon surround, bobbing:
  0. "Drag the bench where you want it, set the height, then pinch Start" (wording default): bobs above the bench's front edge, over the slider and Start, at the very start; hides when Start is pinched. Not shown again when the gear is used later (default).
  1. "Pick up the clay and drop it on the wheel" (wording default): bobs above the clay block once Start is pinched, hides once the clay lands on the wheel.
  2. "Pinch and drag inward or outward to shape the clay" (wording default): bobs above the wheel once the clay is on it, hides after the first drag.
  3. "Match the target" (wording default): bobs above the target vase, above the live %, after the first drag; hides after a few seconds (about 4 s, default) or on the next drag.
- If something needs attention out of view: none. Everything sits on one bench in front of the user.

## Done criteria
Each one can be checked in Lens Studio's preview.
A. When the Lens opens, the bench appears in front of you at table height with the wheel still. Grabbing and dragging the bench moves it, with everything on it, and the height slider raises and lowers it. Pinching Start starts the wheel turning and hides the slider and Start. (default wording)
B. Pinching the gear mid-round pauses the wheel and brings back the slider and Start, and the clay keeps its shape. After moving the bench and pinching Start, the wheel turns again and you carry on sculpting the same piece. (default wording)
1. Grabbing the clay block and releasing it over the wheel places it on the wheel, where it spins.
2. Pinching the spinning clay and dragging inward makes it narrower all the way around at that height. Dragging outward widens it and dragging up makes it taller.
3. The clay's shape changes while you're dragging, not only after you let go (the "responsive, moves in your hands" feel).
4. Pinching Undo reverses the last change to the clay.
5. Pinching Done shows the score above the target vase, along with the potter skill bar going up and any bonus earned.
6. Aiming at the clay shows a glowing ring around it at that height, and dragging plays a clay squish sound.
7. Dragging inward too far makes the clay collapse into a blob at the bottom of the wheel, and pinching Start Over at any time gives a fresh block of clay.
8. At the start a bobbing hint (white text, green neon surround) above the bench says to drag it, set the height and pinch Start. After Start, a hint above the clay says to drop it on the wheel. Once the clay lands it's replaced by a hint above the wheel about pinching and dragging, which goes away after the first drag. The hints never cover the clay, buttons or score.

## Out of scope
- Shop, buying new tools, and upgrades.
- Switching between big and small moves, and a selection of tools on the bench (future level-up unlocks).
- Painting the piece (future bonus).
- Levels and quests beyond one repeatable round.
- Faces, statues and other non-wheel items.
- Two-hand cupping or finger-pressing the clay (the mouse in the preview only acts as one pinching hand).
- Saving skill or progress between sessions, including remembering where the bench was placed.
- Snapping the bench to a real table or floor (the preview can't see real surfaces). Future addition for glasses; mention it in the pitch as the next step.

## Risks and open questions
- "It almost feels like real clay": the logic can be proven in the preview, but the feel of sculpting with real hand tracking is unproven until it's tried on SPECS glasses.
- How the match % is calculated (comparing the clay's profile to the target's profile at many heights) is left to CLAD. Check it feels fair in playtesting.
- Grabbing the bench must not fight with grabbing the clay or pinching the spinning clay. During play the bench can't be grabbed; it can only be moved in placement mode (default).
- A virtual bench placed in a real room can overlap real furniture. The player fixes this by placing it, but it's "feel unproven" until tried on glasses.
- The collapse is a plain blob for now. It could become a funny moment in a later version.
- Bonus rules (for example, a bonus for 90% or higher) and how much the skill bar fills per round were not decided (default: CLAD picks simple, visible values).

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Keep bench placement as its own separate step that hands off to the game when Start is pinched, so snapping to a real table can be added later without changing the game.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
