import { player } from "./player.js";
import {
  items,
  drawSceneItems,
  handleItemPickup,
  smokingFrames,
  drinkingFrames,
  itemSprites,
  phoneMemes,
  guiAssets,
  canPickUp,
  updateItemRespawns,
} from "./items.js";
import {
  scenes,
  changeScene,
  currentScene,
  handleSceneTransitions,
  drawStackSceneWithLayers,
} from "./scenes.js";
import {
  startSceneColliders,
  outsideSceneColliders,
  studyroomSceneColliders,
  stacksSceneColliders,
  stacksForegroundObjects,
} from "./colliders.js";
import { getPlayerFootY, drawColliders, drawStatsGUI } from "./utils.js";
import { TRANSITION_TIME } from "./constants.js";
import {
  playMusicTrack,
  pickNextTrack,
  musicTracks,
  currentTrackIndex,
  setCurrentTrackIndex,
  musicInterval,
  trackFiles,
} from "./music.js";
import { activeItemEvent, setActiveItemEvent } from "./events.js";

// Game mode/state flags
let gameMode = 0;
let showIntroScroll = true;

// Timing and color (if used for other features)
let timer = [0, 0, 0];
let currentColor = [1, 100, 1];

let musicTimer = 0;
let waitingForNextTrack = false;

// p5 preload: load assets
function preload() {
  // Player sprites
  player.sprites.down = loadImage("assets/sprites/stationary.png");
  player.sprites.up = loadImage("assets/sprites/facing_backward.png");
  player.sprites.left = loadImage("assets/sprites/walking_left.png");
  player.sprites.right = loadImage("assets/sprites/walking_right.png");
  player.sprites.walk_left = loadImage("assets/sprites/walking_left.png");
  player.sprites.walk_right = loadImage("assets/sprites/walking_right.png");
  player.sprites.walk_up = loadImage("assets/sprites/facing_backward.png");
  player.sprites.walk_down = loadImage("assets/sprites/walking_forward.png");
  // Backgrounds and intro scroll
  guiAssets.admissionScroll = loadImage(
    "assets/backgrounds/background_start.png"
  );
  scenes[0].background = loadImage("assets/backgrounds/background_reg.png");
  scenes[1].background = loadImage(
    "assets/backgrounds/background_outside.png"
  );
  scenes[2].background = loadImage(
    "assets/backgrounds/background_studyroom.png"
  );
  scenes[3].background = loadImage("assets/backgrounds/background_stacks.png");
  // Foreground object sprite
  guiAssets.bookshelfImg = loadImage(
    "assets/backgrounds/background_item_bookshelf.png"
  );
  if (stacksForegroundObjects) {
    stacksForegroundObjects.forEach(
      (obj) => (obj.sprite = guiAssets.bookshelfImg)
    );
  }
  // GUI images
  guiAssets.statCounterImg = loadImage("assets/gui/stat_counter.png");
  guiAssets.phoneGuiImg = loadImage("assets/gui/phone_gui.png");
  // Item sprites
  itemSprites.marlboro_red = loadImage("assets/items/marlboro_red.png");
  itemSprites.coffee = loadImage("assets/items/coffee.png");
  itemSprites.phone = loadImage("assets/items/phone.png");

  items.forEach((item) => {
    if (item.name === "marlboro_red") item.sprite = itemSprites.marlboro_red;
    if (item.name === "coffee") item.sprite = itemSprites.coffee;
    if (item.name === "phone") item.sprite = itemSprites.phone;
  });
  // Event animation frames
  smokingFrames[0] = loadImage("assets/sprites/smoking_scene_1.png");
  smokingFrames[1] = loadImage("assets/sprites/smoking_scene_2.png");
  drinkingFrames[0] = loadImage("assets/sprites/drinking_scene_1.png");
  drinkingFrames[1] = loadImage("assets/sprites/drinking_scene_2.png");
  // Phone meme images
  phoneMemes.push(loadImage("assets/memes/meme1.png"));
  phoneMemes.push(loadImage("assets/memes/meme2.png"));
  phoneMemes.push(loadImage("assets/memes/meme3.png"));
  // Music tracks
  for (let file of musicInterval ? [] : []) {
  } // (musicInterval imported to ensure it's loaded)
  for (let f of trackFiles) {
    musicTracks.push(loadSound(f));
  }
}

function setup() {
  console.log("✅ setup() fired");
  createCanvas(800, 600);
}

function draw() {
  updateItemRespawns();
  background(220);
  // Draw current scene background
  if (scenes[currentScene].background) {
    image(scenes[currentScene].background, 0, 0, width, height);
  }
  // Intro scroll overlay
  if (showIntroScroll && guiAssets.admissionScroll) {
    // Draw the admission scroll centered
    let w = 900,
      h = 700;
    let x = (width - w) / 2;
    let y = (height - h) / 2;
    image(guiAssets.admissionScroll, x, y, w, h);
    gameMode = 1;
    return; // wait for user input to continue
  }
  // If an item event is active, allow it to draw/effect
  if (activeItemEvent) {
    if (typeof activeItemEvent.draw === "function") {
      activeItemEvent.draw();
      // If phone is open, skip the rest of drawing (UI overlay)
      if (activeItemEvent.name === "phone") {
        return;
      }
    }
    // Apply continuous effect (if any)
    let elapsed = millis() - activeItemEvent.startedAt;
    if (typeof activeItemEvent.effect === "function") {
      activeItemEvent.effect(elapsed);
    }
    // End the event if its duration is over
    if (activeItemEvent.duration && elapsed > activeItemEvent.duration) {
      if (typeof activeItemEvent.onEnd === "function") {
        activeItemEvent.onEnd();
      }
      setActiveItemEvent(null);
    }
  }
  // Draw player and items (if no overlay blocking)
  if (!activeItemEvent) {
    drawPlayer();
    drawSceneItems();
  }
  // Debug: draw colliders of current scene
  if (scenes[currentScene].colliders) {
    drawColliders(scenes[currentScene].colliders, [255, 0, 0, 100]);
  }
  // Scene-specific rendering (e.g., layering in stacks)
  if (
    scenes[currentScene].name === "stacks" &&
    scenes[currentScene].foregroundObjects
  ) {
    drawStackSceneWithLayers(drawPlayer);
  } else {
    if (activeItemEvent) {
      // (If needed, handle any special drawing when an event is active in non-stack scenes)
      // For now, we already drew the event above, so we skip drawing the player here to avoid duplicates.
    } else {
      drawPlayer();
    }
    drawSceneItems();
  }
  // Enforce frame rate
  frameRate(60);
  // Scene boundaries
  scenes[currentScene].borderFunc();
  // Debug info
  fill(0);
  text(`player location: ${player.x}, ${player.y}`, 10, 20);
  // Draw stats GUI (coins, knowledge)
  drawStatsGUI();
  // Handle automatic scene transitions if player stays in a zone
  handleSceneTransitions();
  // Debug: draw transition zones (cyan rectangles)
  if (scenes[currentScene].transitions) {
    drawColliders(scenes[currentScene].transitions, [0, 255, 255, 80]);
  }
  // Show pickup hint
  if (canPickUp) {
    fill(255);
    textSize(16);
    text("Press E to pick up", player.x + player.size / 2, player.y - 10);
  }
  // Process item pickup if player presses E
  handleItemPickup();
  // Music playback logic
  if (!showIntroScroll && musicTracks.length > 0) {
    let track = musicTracks[currentTrackIndex];
    if (track && !track.isPlaying() && !waitingForNextTrack) {
      musicTimer = millis();
      waitingForNextTrack = true;
    }
    if (waitingForNextTrack && millis() - musicTimer > musicInterval) {
      let nextIndex = pickNextTrack();
      playMusicTrack(nextIndex);
      waitingForNextTrack = false;
    }
  }
}

function keyReleased() {
  // If an item event is active that blocks movement, pass key to it instead
  if (activeItemEvent && activeItemEvent.blocksMovement) {
    if (typeof activeItemEvent.onKey === "function") {
      activeItemEvent.onKey(key, keyCode);
    }
    return false;
  }
  let moved = false;
  if (key === "w" || key === "ArrowUp") {
    player.y -= player.velocity;
    player.direction = "up";
    moved = true;
  } else if (key === "s" || key === "ArrowDown") {
    player.y += player.velocity;
    player.direction = "down";
    moved = true;
  } else if (key === "a" || key === "ArrowLeft") {
    player.x -= player.velocity;
    player.direction = "left";
    moved = true;
  } else if (key === "d" || key === "ArrowRight") {
    player.x += player.velocity;
    player.direction = "right";
    moved = true;
  }
  // Toggle walking frame if moved
  if (moved) {
    player.step = 1 - player.step;
    player.moving = true;
    player.lastMoveTime = millis();
  } else {
    player.moving = false;
  }
}

function drawPlayer() {
  let img;
  if (player.moving && player.step === 1) {
    // Use walking frame for current direction
    if (player.direction === "left") img = player.sprites.walk_left;
    else if (player.direction === "right") img = player.sprites.walk_right;
    else if (player.direction === "up") img = player.sprites.walk_up;
    else if (player.direction === "down") img = player.sprites.walk_down;
  } else {
    // Use stationary frame when not moving
    img = player.sprites.down;
  }
  if (img) {
    image(img, player.x, player.y, player.size, player.size * 1.4);
  } else {
    // Fallback debug rectangle if image missing
    fill(255, 0, 0);
    rect(player.x, player.y, player.size, player.size * 1.4);
    text("ERR", player.x + 10, player.y + 20);
  }
  // Stop animation if player hasn't moved for a while
  if (player.moving && millis() - player.lastMoveTime > 500) {
    player.moving = false;
  }
}

function mouseClicked() {
  if (showIntroScroll) {
    // Hide intro scroll and start game
    showIntroScroll = false;
    playMusicTrack(0);
    // currentTrackIndex is set by playMusicTrack; reset music timer and waiting flag
    musicTimer = millis();
    waitingForNextTrack = false;
    return;
  }
}

window.preload = preload;
window.setup = setup;
window.draw = draw;
window.keyReleased = keyReleased;
window.mouseClicked = mouseClicked;
