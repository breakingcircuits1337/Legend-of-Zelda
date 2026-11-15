/**
 * The Legend of Zelda NES - Formal State-Based AI Controller (Finite State Machine)
 *
 * Provides a structured, pattern-driven Finite State Machine (`StateMachineAIController`)
 * specifically designed for tactical dungeon/boss-tier enemies such as Darknuts and Wizzrobes.
 *
 * Unlike simpler pathfinding or wandering enemies (Keese sinusoidal flutter, Octorok
 * random stop-and-shoot), this controller organizes behavior into explicit lifecycle states
 * (`onEnter`, `onUpdate`, `onExit`), transition reasons, pattern tags, and transition history.
 */

export interface StateTransitionRecord<TState extends string> {
  from: TState | null;
  to: TState;
  reason: string;
  tick: number;
}

export interface AIStateDefinition<TState extends string, TContext> {
  name: TState;
  patternTag: string;
  onEnter?: (
    ctx: TContext,
    prevState: TState | null,
    controller: StateMachineAIController<TState, TContext>,
    reason: string
  ) => void;
  onUpdate: (
    ctx: TContext,
    controller: StateMachineAIController<TState, TContext>
  ) => void;
  onExit?: (
    ctx: TContext,
    nextState: TState,
    controller: StateMachineAIController<TState, TContext>,
    reason: string
  ) => void;
}

export interface StateMachineAIControllerOptions<TState extends string, TContext> {
  controllerName: string;
  initialState: TState;
  initialTimer?: number;
  states: Record<TState, AIStateDefinition<TState, TContext>>;
  maxHistory?: number;
}

/**
 * Reusable Finite State Machine AI Controller with lifecycle hooks and diagnostics.
 */
export class StateMachineAIController<TState extends string, TContext> {
  public readonly controllerName: string;
  public currentState: TState;
  public previousState: TState | null = null;
  public stateTimer: number = 0;
  public ticksInState: number = 0;
  public totalTicks: number = 0;
  public transitionCount: number = 0;
  public lastTransitionReason: string = 'init';
  public stateHistory: StateTransitionRecord<TState>[] = [];

  private readonly states: Record<TState, AIStateDefinition<TState, TContext>>;
  private readonly maxHistory: number;

  constructor(options: StateMachineAIControllerOptions<TState, TContext>) {
    this.controllerName = options.controllerName;
    this.currentState = options.initialState;
    this.stateTimer = options.initialTimer ?? 0;
    this.states = options.states;
    this.maxHistory = options.maxHistory ?? 24;

    this.stateHistory.push({
      from: null,
      to: options.initialState,
      reason: 'init',
      tick: 0,
    });
  }

  /**
   * Returns metadata for the active state definition.
   */
  public getActiveStateDefinition(): AIStateDefinition<TState, TContext> {
    return this.states[this.currentState];
  }

  /**
   * Returns the descriptive pattern tag of the current state (e.g. 'wall_slide_charge', 'tactical_warp').
   */
  public getCurrentPatternTag(): string {
    return this.states[this.currentState]?.patternTag ?? 'unknown';
  }

  /**
   * Executes one frame of the active state handler.
   */
  public update(ctx: TContext): void {
    this.totalTicks++;
    this.ticksInState++;
    const handler = this.states[this.currentState];
    handler.onUpdate(ctx, this);
  }

  /**
   * Performs a formal state transition, invoking `onExit` on the outgoing state
   * and `onEnter` on the incoming state, while logging transition telemetry.
   */
  public transitionTo(
    nextState: TState,
    ctx: TContext,
    reason: string = 'transition'
  ): void {
    const prevState = this.currentState;
    const prevHandler = this.states[prevState];
    const nextHandler = this.states[nextState];

    if (prevHandler?.onExit) {
      prevHandler.onExit(ctx, nextState, this, reason);
    }

    this.previousState = prevState;
    this.currentState = nextState;
    this.ticksInState = 0;
    this.transitionCount++;
    this.lastTransitionReason = reason;

    this.stateHistory.push({
      from: prevState,
      to: nextState,
      reason,
      tick: this.totalTicks,
    });
    if (this.stateHistory.length > this.maxHistory) {
      this.stateHistory.shift();
    }

    if (nextHandler?.onEnter) {
      nextHandler.onEnter(ctx, prevState, this, reason);
    }
  }

  /**
   * Synchronizes state directly without firing exit/enter side effects (for initialization or manual overrides).
   */
  public forceState(nextState: TState, timer?: number): void {
    if (this.currentState !== nextState) {
      this.previousState = this.currentState;
      this.currentState = nextState;
      this.ticksInState = 0;
    }
    if (typeof timer === 'number') {
      this.stateTimer = timer;
    }
  }
}
