/**
 * Unit Test Suite for the Formal State-Based AI Controller (`StateMachineAIController`)
 * driving Darknut and Wizzrobe enemies with distinct tactical patterns vs Octorok/Keese.
 */

import { StateMachineAIController } from '../src/game/stateAIController';
import { DarknutEnemy } from '../src/game/darknutEnemy';
import { WizzrobeEnemy, MagicProjectileData } from '../src/game/wizzrobeEnemy';
import { OctorokEnemy } from '../src/game/octorokEnemy';
import { KeeseEnemy } from '../src/game/keeseEnemy';
import { Direction, EnemyType, ItemType, PlayerState } from '../src/types';

function createMockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    x: 120,
    y: 88,
    dir: Direction.UP,
    moving: false,
    isAttacking: false,
    attackTimer: 0,
    animFrame: 0,
    animTimer: 0,
    hearts: 6,
    maxHearts: 6,
    swordTier: 1,
    bItem: ItemType.NONE,
    inventory: {
      hasSword: true,
      hasBoomerang: false,
      hasBow: false,
      hasCandle: false,
      hasCompass: false,
      hasDungeonMap: false,
      rupees: 10,
      bombs: 4,
      keys: 1,
      triforcePieces: 0,
    },
    invincibleTimer: 0,
    knockback: null,
    isHoldingItem: false,
    heldItemType: null,
    heldItemTimer: 0,
    ...overrides,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

console.log('--- RUNNING STATE-BASED AI CONTROLLER TEST SUITE ---');

// Test 1: Generic StateMachineAIController Lifecycle & Transition Telemetry
console.log('\n[Test 1: StateMachineAIController Lifecycle & History]');
type TestState = 'idle' | 'active' | 'cooldown';
const lifecycleEvents: string[] = [];

const testFsm = new StateMachineAIController<TestState, { step: number }>({
  controllerName: 'TestFSM',
  initialState: 'idle',
  initialTimer: 2,
  states: {
    idle: {
      name: 'idle',
      patternTag: 'standby_pattern',
      onUpdate: (ctx, ctrl) => {
        lifecycleEvents.push(`idle:update:${ctx.step}`);
        ctrl.stateTimer--;
        if (ctrl.stateTimer <= 0) {
          ctrl.transitionTo('active', ctx, 'timer_elapsed');
        }
      },
      onExit: (_ctx, next) => {
        lifecycleEvents.push(`idle:exit->${next}`);
      },
    },
    active: {
      name: 'active',
      patternTag: 'burst_pattern',
      onEnter: (_ctx, prev, ctrl) => {
        ctrl.stateTimer = 1;
        lifecycleEvents.push(`active:enter<-${prev}`);
      },
      onUpdate: (ctx, ctrl) => {
        lifecycleEvents.push(`active:update:${ctx.step}`);
        ctrl.stateTimer--;
        if (ctrl.stateTimer <= 0) {
          ctrl.transitionTo('cooldown', ctx, 'burst_finished');
        }
      },
    },
    cooldown: {
      name: 'cooldown',
      patternTag: 'rest_pattern',
      onEnter: () => {
        lifecycleEvents.push('cooldown:enter');
      },
      onUpdate: () => {},
    },
  },
});

assert(testFsm.currentState === 'idle', 'Initial state is idle');
assert(testFsm.getCurrentPatternTag() === 'standby_pattern', 'Initial patternTag is standby_pattern');
testFsm.update({ step: 1 });
testFsm.update({ step: 2 });
assert(testFsm.currentState === 'active', 'Transitioned idle -> active on timer expiry');
assert(testFsm.previousState === 'idle', 'Previous state recorded as idle');
assert(testFsm.lastTransitionReason === 'timer_elapsed', 'Transition reason recorded');
assert(testFsm.transitionCount === 1, 'Transition count incremented to 1');
assert(
  lifecycleEvents.includes('idle:exit->active') && lifecycleEvents.includes('active:enter<-idle'),
  'onExit and onEnter lifecycle hooks invoked cleanly'
);
testFsm.update({ step: 3 });
assert(testFsm.currentState === 'cooldown' && testFsm.transitionCount === 2, 'Chained transition active -> cooldown');
assert(testFsm.stateHistory.length === 3, 'State history tracks init + 2 transitions');

// Test 2: Darknut State Controller & Corridor Sightline Lock-On
console.log('\n[Test 2: Darknut State Controller & Corridor Lock-On]');
const noCollision = () => false;
const darknut = new DarknutEnemy({
  id: 'darknut_fsm_1',
  type: EnemyType.DARKNUT_BLUE,
  x: 48,
  y: 80,
  dir: Direction.LEFT,
  chargeRange: 64,
});

assert(darknut.aiController instanceof StateMachineAIController, 'Darknut owns a StateMachineAIController instance');
assert(darknut.aiController.controllerName === 'DarknutTacticalFSM', 'Darknut uses DarknutTacticalFSM');
assert(darknut.aiController.getCurrentPatternTag() === 'tactical_lane_patrol', 'Darknut starts in tactical_lane_patrol');

// Player is 96px away (> 64px chargeRange, <= 64 * 1.6 = 102.4px) directly down the same horizontal corridor lane (y=80)
const corridorPlayer = createMockPlayer({ x: 144, y: 80 });
darknut.update(corridorPlayer, noCollision, () => {});
assert(darknut.darknutState === 'windup', 'Darknut locks onto Link down an unobstructed corridor lane');
assert(darknut.aiController.lastTransitionReason === 'player_spotted', 'Transition reason recorded as player_spotted');
assert(darknut.aiController.getCurrentPatternTag() === 'shield_brace_windup', 'Pattern tag updated to shield_brace_windup');

// Run through windup -> charge -> recover -> patrol
for (let i = 0; i < 15; i++) {
  darknut.update(corridorPlayer, noCollision, () => {});
}
assert(darknut.darknutState === 'charge', 'Darknut transitions into armored charge after windup');
assert(darknut.aiController.getCurrentPatternTag() === 'wall_slide_armored_charge', 'Charge pattern tag active');

for (let i = 0; i < 45; i++) {
  darknut.update(corridorPlayer, noCollision, () => {});
}
assert(darknut.darknutState === 'recover', 'Darknut transitions into guard_recovery after charge');

for (let i = 0; i < 22; i++) {
  darknut.update(corridorPlayer, noCollision, () => {});
}
assert(darknut.darknutState === 'patrol', 'Darknut completes full FSM cycle back to patrol');
assert(darknut.aiController.transitionCount >= 4, 'Darknut logged all 4 tactical state transitions');

// Test 3: Wizzrobe State Controller Full Warp-Cast-Vanish Cycle
console.log('\n[Test 3: Wizzrobe State Controller Warp-Cast-Vanish Cycle]');
const wizzrobe = new WizzrobeEnemy({
  id: 'wizzrobe_fsm_1',
  x: 112,
  y: 64,
});

assert(wizzrobe.aiController instanceof StateMachineAIController, 'Wizzrobe owns a StateMachineAIController instance');
assert(wizzrobe.aiController.controllerName === 'WizzrobeWarpFSM', 'Wizzrobe uses WizzrobeWarpFSM');
assert(wizzrobe.aiController.getCurrentPatternTag() === 'ether_concealment', 'Wizzrobe starts in ether_concealment');

const playerTarget = createMockPlayer({ x: 120, y: 88 });
const projectiles: MagicProjectileData[] = [];

// Step until Wizzrobe finishes hidden -> appearing -> casting -> vanishing -> hidden
let sawAppearing = false;
let sawCasting = false;
let sawVanishing = false;
let returnedHidden = false;

for (let tick = 0; tick < 180; tick++) {
  wizzrobe.update(
    playerTarget,
    noCollision,
    (proj) => projectiles.push(proj),
    () => {}
  );

  if (wizzrobe.wizzrobeState === 'appearing') sawAppearing = true;
  if (wizzrobe.wizzrobeState === 'casting') sawCasting = true;
  if (wizzrobe.wizzrobeState === 'vanishing') sawVanishing = true;
  if (sawVanishing && wizzrobe.wizzrobeState === 'hidden') {
    returnedHidden = true;
    break;
  }
}

assert(sawAppearing, 'Wizzrobe entered appearing state via FSM');
assert(sawCasting, 'Wizzrobe entered casting state via FSM');
assert(sawVanishing, 'Wizzrobe entered vanishing state via FSM');
assert(returnedHidden, 'Wizzrobe returned to hidden state after vanishing');
assert(projectiles.length === 1, 'Wizzrobe fired exactly 1 aimed magic projectile during its cast window');
assert(wizzrobe.warpCount === 1, 'Wizzrobe incremented warpCount on materialization');
assert(
  wizzrobe.aiController.stateHistory.map((h) => h.to).join('->') ===
    'hidden->appearing->casting->vanishing->hidden',
  'Wizzrobe FSM transition history follows exact hidden->appearing->casting->vanishing->hidden cycle'
);

// Test 4: Contrast Against Simpler Keese & Octorok Behaviors
console.log('\n[Test 4: Behavioral Distinction vs Octorok and Keese]');
const octorok = new OctorokEnemy({ id: 'octorok_cmp', x: 64, y: 80 });
const keese = new KeeseEnemy({ id: 'keese_cmp', x: 64, y: 80 });

assert(
  (octorok as any).aiController === undefined && (keese as any).aiController === undefined,
  'Octorok and Keese use simpler patrol/flight loops without StateMachineAIController'
);
assert(
  typeof darknut.aiController.getCurrentPatternTag() === 'string' &&
    typeof wizzrobe.aiController.getCurrentPatternTag() === 'string',
  'Darknut and Wizzrobe expose explicit tactical FSM pattern tags'
);

console.log('\n>>> ALL STATE-BASED AI CONTROLLER TESTS PASSED SUCCESSFULLY! <<<\n');
