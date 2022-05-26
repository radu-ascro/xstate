import { onDestroy } from 'svelte';
import { Readable, readable } from 'svelte/store';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineImplementations,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  StateConfig,
  StateFrom
} from 'xstate';

type Prop<T, K> = K extends keyof T ? T[K] : never;
interface UseMachineOptions<
  TContext extends object,
  TEvent extends EventObject
> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

type RestParams<
  TMachine extends AnyStateMachine
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineImplementations<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta'],
          true
        >
    ]
  : [
      options?: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineImplementations<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta']
        >
    ];

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = {
  state: Readable<StateFrom<TMachine>>;
  send: Prop<TInterpreter, 'send'>;
  service: TInterpreter;
};

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const {
    context,
    guards,
    actions,
    actors,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    actors,
    delays
  };

  const resolvedMachine = machine.provide(machineConfig as any);

  const service = interpret(resolvedMachine, interpreterOptions).start(
    rehydratedState ? (machine.createState(rehydratedState) as any) : undefined
  );

  onDestroy(() => service.stop());

  const state = readable(service.getSnapshot(), (set) => {
    return service.subscribe((state) => {
      if (state.changed) {
        set(state);
      }
    }).unsubscribe;
  });

  return { state, send: service.send, service } as any;
}
