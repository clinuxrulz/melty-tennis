import { createStore, getObserver, onCleanup } from "solid-js";
import type { ECS } from "@oasys/oecs";
import type { Query } from "@oasys/oecs";
import type { ResourceDef, ResourceReader } from "@oasys/oecs";
import type { EntityID } from "@oasys/oecs";
import type { ComponentDef, ComponentSchema } from "@oasys/oecs";

class TriggerStore {
  #triggers: { [key: number]: number };
  #setTriggers: (fn: (s: { [key: number]: number }) => { [key: number]: number }) => void;
  #nextKey = 0;
  #keyToId = new Map<string, number>();

  constructor() {
    const [triggers, setTriggers] = createStore<{ [key: number]: number }>({});
    this.#triggers = triggers;
    this.#setTriggers = setTriggers;
  }

  track(key: string): void {
    const id = this.#getOrCreate(key);
    const _ = this.#triggers[id];
  }

  dirty(key: string): void {
    const id = this.#keyToId.get(key);
    if (id === undefined) return;
    this.#setTriggers((s) => {
      s[id] = 1 - s[id];
      return s;
    });
  }

  #getOrCreate(key: string): number {
    let id = this.#keyToId.get(key);
    if (id !== undefined) return id;
    id = this.#nextKey++;
    this.#keyToId.set(key, id);
    this.#setTriggers((s) => {
      s[id] = 0;
      return s;
    });
    return id;
  }
}

class ReactiveRef<T> {
  #getValue: () => T;
  #dirty: () => void;
  #triggerStore: TriggerStore;
  #key: string;
  #refCount = 0;
  #tracked = false;

  constructor(triggerStore: TriggerStore, key: string, getValue: () => T, dirty: () => void) {
    this.#triggerStore = triggerStore;
    this.#key = key;
    this.#getValue = getValue;
    this.#dirty = dirty;
  }

  get value(): T {
    this.#triggerStore.track(this.#key);
    const observer = getObserver();
    if (observer !== null) {
      this.#refCount++;
      if (!this.#tracked) {
        this.#tracked = true;
        onCleanup(() => {
          this.#refCount--;
          if (this.#refCount === 0) {
            this.#tracked = false;
          }
        });
      }
    }
    return this.#getValue();
  }

  dirty(): void {
    this.#dirty();
  }
}

class ReactiveResource<F extends readonly string[]> {
  #triggerStore: TriggerStore;
  #def: ResourceDef<F>;
  #resource: ResourceReader<F>;
  #fieldRefs: Map<string, ReactiveRef<number>>;

  constructor(triggerStore: TriggerStore, def: ResourceDef<F>, resource: ResourceReader<F>) {
    this.#triggerStore = triggerStore;
    this.#def = def;
    this.#resource = resource;
    this.#fieldRefs = new Map();
  }

  #getField(field: F[number]): number {
    const observer = getObserver();
    if (observer === null) {
      return this.#resource[field];
    }
    const key = `resource:${this.#def}:${field}`;
    let ref = this.#fieldRefs.get(field);
    if (ref === undefined) {
      ref = new ReactiveRef(
        this.#triggerStore,
        key,
        () => this.#resource[field],
        () => this.#triggerStore.dirty(key),
      );
      this.#fieldRefs.set(field, ref);
    }
    return ref.value;
  }

  get delta(): number {
    return this.#getField("delta" as F[number]);
  }

  get elapsed(): number {
    return this.#getField("elapsed" as F[number]);
  }

  get<K extends F[number]>(field: K): number {
    return this.#getField(field);
  }
}

class ReactiveEntity {
  #triggerStore: TriggerStore;
  #ecs: ECS;
  #id: EntityID;
  #componentRefs: Map<string, ReactiveRef<boolean>>;
  #fieldRefs: Map<string, ReactiveRef<number>>;

  constructor(triggerStore: TriggerStore, ecs: ECS, id: EntityID) {
    this.#triggerStore = triggerStore;
    this.#ecs = ecs;
    this.#id = id;
    this.#componentRefs = new Map();
    this.#fieldRefs = new Map();
  }

  get id(): EntityID {
    return this.#id;
  }

  hasComponent(def: ComponentDef): boolean {
    const observer = getObserver();
    if (observer === null) {
      return this.#ecs.has_component(this.#id, def);
    }
    const key = `entity:${this.#id}:has:${def}`;
    let ref = this.#componentRefs.get(key);
    if (ref === undefined) {
      ref = new ReactiveRef(
        this.#triggerStore,
        key,
        () => this.#ecs.has_component(this.#id, def),
        () => this.#triggerStore.dirty(key),
      );
      this.#componentRefs.set(key, ref);
    }
    return ref.value;
  }

  getField<S extends ComponentSchema>(def: ComponentDef<S>, field: string & keyof S): number {
    const observer = getObserver();
    if (observer === null) {
      return this.#ecs.get_field(this.#id, def, field);
    }
    const key = `entity:${this.#id}:${def}:${field}`;
    let ref = this.#fieldRefs.get(key);
    if (ref === undefined) {
      ref = new ReactiveRef(
        this.#triggerStore,
        key,
        () => this.#ecs.get_field(this.#id, def, field),
        () => this.#triggerStore.dirty(key),
      );
      this.#fieldRefs.set(key, ref);
    }
    return ref.value;
  }
}

class ReactiveQuery<Defs extends readonly ComponentDef[]> {
  #triggerStore: TriggerStore;
  #ecs: ECS;
  #query: Query<Defs>;
  #defs: Defs;

  constructor(triggerStore: TriggerStore, ecs: ECS, defs: Defs) {
    this.#triggerStore = triggerStore;
    this.#ecs = ecs;
    this.#defs = defs;
    this.#query = ecs.query(...defs);
  }

  get archetype_count(): number {
    const observer = getObserver();
    if (observer === null) {
      return this.#query.archetype_count;
    }
    const key = `query:${this.#query.archetype_count}:count`;
    this.#triggerStore.track(key);
    return this.#query.archetype_count;
  }

  count(): number {
    const observer = getObserver();
    if (observer === null) {
      return this.#query.count();
    }
    const key = `query:${this.#query.count()}:count`;
    this.#triggerStore.track(key);
    return this.#query.count();
  }

  get archetypes() {
    const observer = getObserver();
    if (observer === null) {
      return this.#query.archetypes;
    }
    const key = `query:${this.#query.archetype_count}:archetypes`;
    this.#triggerStore.track(key);
    return this.#query.archetypes;
  }

  *[Symbol.iterator]() {
    const observer = getObserver();
    const archetypes = this.#query.archetypes;
    if (observer === null) {
      for (const arch of this.#query) {
        yield arch;
      }
      return;
    }
    const archKey = `query:${archetypes.length}:archetypes`;
    this.#triggerStore.track(archKey);
    for (const arch of this.#query) {
      yield new ReactiveArchetype(this.#triggerStore, this.#ecs, arch);
    }
  }

  and<D extends ComponentDef[]>(...comps: D): ReactiveQuery<[...Defs, ...D]> {
    return new ReactiveQuery(this.#triggerStore, this.#ecs, [...this.#defs, ...comps]);
  }

  not(...comps: ComponentDef[]): ReactiveQuery<Defs> {
    return new ReactiveQuery(this.#triggerStore, this.#ecs, this.#defs);
  }

  any_of(...comps: ComponentDef[]): ReactiveQuery<Defs> {
    return new ReactiveQuery(this.#triggerStore, this.#ecs, this.#defs);
  }
}

interface ArchetypeLike {
  readonly id: number;
  readonly entity_ids: Uint32Array;
  readonly entity_count: number;
  has_component(id: number): boolean;
  get_column<S extends ComponentSchema, K extends string & keyof S>(def: ComponentDef<S>, field: K): any;
}

class ReactiveArchetype {
  #triggerStore: TriggerStore;
  #ecs: ECS;
  #archetype: ArchetypeLike;

  constructor(triggerStore: TriggerStore, ecs: ECS, archetype: ArchetypeLike) {
    this.#triggerStore = triggerStore;
    this.#ecs = ecs;
    this.#archetype = archetype;
  }

  get entity_ids(): Uint32Array {
    const observer = getObserver();
    if (observer === null) {
      return this.#archetype.entity_ids;
    }
    const key = `arch:${this.#archetype.id}:entity_ids`;
    this.#triggerStore.track(key);
    return this.#archetype.entity_ids;
  }

  get entity_count(): number {
    const observer = getObserver();
    if (observer === null) {
      return this.#archetype.entity_count;
    }
    const key = `arch:${this.#archetype.id}:count`;
    this.#triggerStore.track(key);
    return this.#archetype.entity_count;
  }

  has_component(id: number): boolean {
    const observer = getObserver();
    if (observer === null) {
      return this.#archetype.has_component(id);
    }
    const key = `arch:${this.#archetype.id}:has:${id}`;
    this.#triggerStore.track(key);
    return this.#archetype.has_component(id);
  }

  get_column<S extends ComponentSchema, K extends string & keyof S>(def: ComponentDef<S>, field: K): any {
    const observer = getObserver();
    if (observer === null) {
      return this.#archetype.get_column(def, field);
    }
    const key = `arch:${this.#archetype.id}:col`;
    this.#triggerStore.track(key);
    return this.#archetype.get_column(def, field);
  }
}

export class ReactiveECS {
  #ecs: ECS;
  #triggers: TriggerStore;

  constructor(ecs: ECS) {
    this.#ecs = ecs;
    this.#triggers = new TriggerStore();
  }

  get ecs(): ECS {
    return this.#ecs;
  }

  query<Defs extends ComponentDef[]>(...defs: Defs): ReactiveQuery<Defs> {
    return new ReactiveQuery(this.#triggers, this.#ecs, defs);
  }

  resource<F extends readonly string[]>(def: ResourceDef<F>): ReactiveResource<F> {
    return new ReactiveResource(this.#triggers, def, this.#ecs.resource(def));
  }

  entity(id: EntityID): ReactiveEntity {
    return new ReactiveEntity(this.#triggers, this.#ecs, id);
  }
}