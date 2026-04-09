import { type Accessor, createMemo, untrack } from "solid-js";

export function mkSetProtector<A>(
  setter: (x: A) => void,
): (x: A) => void {
  let isSetting = false;
  let value: A | undefined = undefined;
  return (x: A) => {
    value = x;
    if (isSetting) {
      return;
    }
    isSetting = true;
    setTimeout(() => {
      isSetting = false;
      setter(value!);
      value = undefined;
    });
  };
}

export function when<A,B>(a: Accessor<A | undefined>, fn: (a: Accessor<A>) => B): Accessor<B | undefined> {
  let hasA = createMemo(() => a() != undefined);
  return createMemo(() => {
    if (!hasA()) {
      return undefined;
    }
    let a2 = a as Accessor<NonNullable<ReturnType<typeof a>>>;
    return untrack(() => fn(a2));
  });
}
